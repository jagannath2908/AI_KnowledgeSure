import re
import math
import logging
from typing import List, Dict, Any, Optional
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import text
import google.generativeai as genai

from app.config import settings
from app.models import DocumentChunk, Document
from app.services.ingestion import generate_mock_embedding

logger = logging.getLogger(__name__)

def get_query_embedding(query: str) -> List[float]:
    """Generates embedding for a search query using NVIDIA/Llama or Gemini text-embedding-004."""
    # 1. Try NVIDIA / Llama embeddings if NVIDIA_API_KEY is configured
    if settings.NVIDIA_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(
                base_url=settings.NVIDIA_BASE_URL,
                api_key=settings.NVIDIA_API_KEY,
                timeout=8.0
            )
            response = client.embeddings.create(
                input=[query],
                model=settings.NVIDIA_EMBED_MODEL,
                extra_body={"input_type": "query"} if "nv-embed" in settings.NVIDIA_EMBED_MODEL or "nemotron" in settings.NVIDIA_EMBED_MODEL else {}
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"NVIDIA/Llama query embedding failed: {e}. Trying fallback...")

    # 2. Try Gemini if GEMINI_API_KEY is configured
    if settings.GEMINI_API_KEY:
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            response = genai.embed_content(
                model=settings.GEMINI_EMBEDDING_MODEL,
                content=query,
                task_type="retrieval_query"
            )
            return response["embedding"]
        except Exception as e:
            logger.error(f"Gemini query embedding failed: {e}. Falling back to mock embedding.")

    return generate_mock_embedding(query)

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculates cosine similarity between two numeric lists."""
    if not v1 or not v2:
        return 0.0
    if len(v1) != len(v2):
        return 0.0
    arr1 = np.array(v1, dtype=float)
    arr2 = np.array(v2, dtype=float)
    dot = np.dot(arr1, arr2)
    norm1 = np.linalg.norm(arr1)
    norm2 = np.linalg.norm(arr2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot / (norm1 * norm2))


def search_similar_chunks(
    db: Session,
    query: str,
    top_k: int = 5,
    threshold: Optional[float] = None
) -> List[Dict[str, Any]]:
    """
    Searches for the most relevant document chunks for the query.
    Uses pgvector native cosine distance if available, or Python cosine similarity fallback.
    """
    query_emb = get_query_embedding(query)
    min_score = threshold if threshold is not None else settings.SIMILARITY_THRESHOLD

    results = []

    # Check if PostgreSQL and pgvector can be used
    is_postgres = "postgresql" in settings.DATABASE_URL
    use_native_pgvector = False

    effective_k = max(top_k, 8)

    if is_postgres:
        try:
            # Query using pgvector cosine_distance (<=> operator)
            stmt = (
                db.query(
                    DocumentChunk,
                    Document.title.label("doc_title"),
                    DocumentChunk.embedding.cosine_distance(query_emb).label("distance")
                )
                .join(Document, Document.id == DocumentChunk.document_id)
                .filter(Document.status == "indexed")
                .order_by("distance")
                .limit(effective_k * 4)
            )
            rows = stmt.all()

            candidate_rows = []
            for chunk, doc_title, distance in rows:
                score = round(1.0 - float(distance), 4)
                if score >= min_score or (not candidate_rows and score >= 0.25):
                    candidate_rows.append((score, chunk, doc_title))

            # Balanced multi-document selection
            selected_items = []
            seen_chunks = set()
            seen_docs = set()

            # Pass 1: ensure top chunk from each relevant document is represented
            for score, chunk, doc_title in candidate_rows:
                if chunk.document_id not in seen_docs and len(selected_items) < effective_k:
                    selected_items.append((score, chunk, doc_title))
                    seen_chunks.add(chunk.id)
                    seen_docs.add(chunk.document_id)

            # Pass 2: fill remaining slots with highest scoring chunks
            for score, chunk, doc_title in candidate_rows:
                if chunk.id not in seen_chunks and len(selected_items) < effective_k:
                    selected_items.append((score, chunk, doc_title))
                    seen_chunks.add(chunk.id)

            selected_items.sort(key=lambda x: x[0], reverse=True)
            for score, chunk, doc_title in selected_items:
                results.append({
                    "source_id": chunk.id,
                    "document_id": chunk.document_id,
                    "document_title": doc_title,
                    "chunk_index": chunk.chunk_index,
                    "content": chunk.content,
                    "score": max(0.0, min(1.0, score)),
                    "metadata": chunk.chunk_metadata or {}
                })
            use_native_pgvector = True
        except Exception as e:
            logger.warning(f"pgvector query failed, falling back to python similarity search: {e}")
            use_native_pgvector = False

    if not use_native_pgvector:
        # In-memory vector similarity across active chunks
        chunks = (
            db.query(DocumentChunk, Document.title.label("doc_title"))
            .join(Document, Document.id == DocumentChunk.document_id)
            .filter(Document.status == "indexed")
            .all()
        )

        import json
        scored_items = []
        # Pre-process query keywords for light lexical boosting
        query_words = set(re.findall(r"\w+", query.lower())) - {"what", "is", "the", "about", "all", "which", "my", "in", "it", "to", "for", "a", "an"}

        for chunk, doc_title in chunks:
            # Skip noise chunks
            if not chunk.content or len(chunk.content.strip()) < 35:
                continue

            chunk_emb = chunk.embedding
            # Parse embedding if stored as string, vector, or ndarray
            if isinstance(chunk_emb, str):
                try:
                    chunk_emb = json.loads(chunk_emb)
                except Exception:
                    try:
                        # pgvector text format '[0.1,0.2,...]'
                        chunk_emb = [float(x.strip()) for x in chunk_emb.strip("[]").split(",") if x.strip()]
                    except Exception:
                        pass
            elif hasattr(chunk_emb, "tolist"):
                chunk_emb = chunk_emb.tolist()

            if isinstance(chunk_emb, (list, tuple)) and len(chunk_emb) > 0:
                sim = cosine_similarity(query_emb, chunk_emb)
                
                # Check keyword overlap bonus (up to +0.08)
                chunk_lower = chunk.content.lower()
                matches = sum(1 for w in query_words if w in chunk_lower)
                bonus = min(0.08, matches * 0.02)
                effective_score = sim + bonus

                scored_items.append((effective_score, sim, chunk, doc_title))

        # Sort descending by effective score
        scored_items.sort(key=lambda x: x[0], reverse=True)

        effective_min = min(min_score, 0.40)
        filtered_items = [item for item in scored_items if item[1] >= effective_min]
        if not filtered_items and scored_items:
            # Fallback to top candidates if above lenient floor (0.25)
            filtered_items = [item for item in scored_items if item[1] >= 0.25][:effective_k]

        # Multi-document balanced selection: ensure each relevant document is represented
        selected_items = []
        seen_chunks = set()
        seen_docs = set()

        # Pass 1: Select top matching chunk from each relevant document
        for eff_score, raw_sim, chunk, doc_title in filtered_items:
            if chunk.document_id not in seen_docs and len(selected_items) < effective_k:
                selected_items.append((eff_score, raw_sim, chunk, doc_title))
                seen_chunks.add(chunk.id)
                seen_docs.add(chunk.document_id)

        # Pass 2: Fill remaining slots with the highest scoring chunks
        for eff_score, raw_sim, chunk, doc_title in filtered_items:
            if chunk.id not in seen_chunks and len(selected_items) < effective_k:
                selected_items.append((eff_score, raw_sim, chunk, doc_title))
                seen_chunks.add(chunk.id)

        # Sort selected items by score
        selected_items.sort(key=lambda x: x[0], reverse=True)

        for eff_score, raw_sim, chunk, doc_title in selected_items:
            results.append({
                "source_id": chunk.id,
                "document_id": chunk.document_id,
                "document_title": doc_title,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "score": round(raw_sim, 4),
                "metadata": chunk.chunk_metadata or {}
            })

    return results[:effective_k]
