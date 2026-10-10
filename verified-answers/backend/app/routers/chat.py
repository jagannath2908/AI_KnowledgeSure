import os
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import settings
from app.database import get_db
from app.models import ChatHistory, Document, DocumentChunk, User
from app.schemas import (
    ChatQueryRequest, ChatQueryResponse, ChatHistoryResponse, SourceItem,
    ReportExportResponse
)
from app.dependencies import get_current_user
from app.services.retrieval import search_similar_chunks
from app.services.answer import generate_grounded_answer
from app.services.knowledge_graph import build_multi_hop_knowledge_graph
from app.services.reporting import generate_markdown_report, generate_pdf_report, ensure_reports_dir

router = APIRouter(prefix="/chat", tags=["Chat & Q&A"])

@router.post("/query", response_model=ChatQueryResponse)
def ask_question(
    request: ChatQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits a user query, retrieves relevant document chunks,
    performs multi-hop reasoning with citations, and generates a multi-hop knowledge graph.
    """
    # 1. Retrieve sources
    sources = search_similar_chunks(
        db=db,
        query=request.query,
        top_k=request.top_k or max(settings.TOP_K_SOURCES, 8),
        threshold=request.threshold
    )

    # 2. Synthesize grounded answer with multi-hop reasoning
    answer_text, confidence_score, is_grounded, reasoning_steps = generate_grounded_answer(
        query=request.query,
        sources=sources
    )

    # 3. Construct Multi-Hop Knowledge Graph
    kg_data = build_multi_hop_knowledge_graph(
        query=request.query,
        sources=sources,
        answer=answer_text
    )

    # 4. Persist in ChatHistory with reasoning & graph metadata
    stored_metadata = {
        "sources": sources,
        "reasoning_steps": reasoning_steps,
        "knowledge_graph": kg_data
    }

    chat_log = ChatHistory(
        user_id=current_user.id,
        query=request.query,
        answer=answer_text,
        sources=stored_metadata,
        confidence_score=confidence_score,
        is_grounded=is_grounded
    )
    db.add(chat_log)
    db.commit()
    db.refresh(chat_log)

    formatted_sources = [SourceItem(**s) for s in sources]
    return ChatQueryResponse(
        id=chat_log.id,
        query=chat_log.query,
        answer=chat_log.answer,
        confidence_score=chat_log.confidence_score,
        is_grounded=chat_log.is_grounded,
        sources=formatted_sources,
        reasoning_steps=reasoning_steps,
        knowledge_graph=kg_data,
        created_at=chat_log.created_at
    )

@router.get("/history", response_model=ChatHistoryResponse)
def get_chat_history(
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetches past Q&A conversation history for the current user."""
    history = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == current_user.id)
        .order_by(ChatHistory.created_at.desc())
        .limit(limit)
        .all()
    )

    items = []
    for h in history:
        raw_src = h.sources or []
        parsed_sources = []
        reasoning_steps = None
        knowledge_graph = None

        if isinstance(raw_src, dict):
            parsed_sources = raw_src.get("sources", [])
            reasoning_steps = raw_src.get("reasoning_steps")
            knowledge_graph = raw_src.get("knowledge_graph")
        elif isinstance(raw_src, list):
            parsed_sources = raw_src

        items.append(ChatQueryResponse(
            id=h.id,
            query=h.query,
            answer=h.answer,
            confidence_score=h.confidence_score,
            is_grounded=h.is_grounded,
            sources=[SourceItem(**s) for s in parsed_sources if isinstance(s, dict)],
            reasoning_steps=reasoning_steps,
            knowledge_graph=knowledge_graph,
            created_at=h.created_at
        ))

    return ChatHistoryResponse(items=items, total=len(items))


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
def clear_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clears all conversation history for the current user."""
    db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).delete()
    db.commit()
    return None

@router.get("/report/{chat_id}")
def export_verification_report(
    chat_id: int,
    format: str = Query("markdown", pattern="^(markdown|pdf)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates and downloads an audit report for a specific answer in Markdown or PDF."""
    chat_log = db.query(ChatHistory).filter(ChatHistory.id == chat_id).first()
    if not chat_log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat log not found")

    ensure_reports_dir()

    if format == "pdf":
        filename = f"verification_report_{chat_id}.pdf"
        file_path = os.path.join(settings.REPORTS_DIR, filename)
        generate_pdf_report(chat_log, current_user.email, file_path)
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/pdf"
        )
    else:
        # Markdown
        filename = f"verification_report_{chat_id}.md"
        md_content = generate_markdown_report(chat_log, current_user.email)
        return PlainTextResponse(
            content=md_content,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "text/markdown; charset=utf-8"
            }
        )

@router.get("/stats")
def get_system_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns platform metrics for documents, chunks, and Q&A grounding rates."""
    total_docs = db.query(Document).count()
    indexed_docs = db.query(Document).filter(Document.status == "indexed").count()
    total_chunks = db.query(DocumentChunk).count()
    total_queries = db.query(ChatHistory).count()
    
    avg_conf = db.query(func.avg(ChatHistory.confidence_score)).scalar() or 0.0

    return {
        "total_documents": total_docs,
        "indexed_documents": indexed_docs,
        "total_chunks": total_chunks,
        "total_queries": total_queries,
        "average_confidence": round(float(avg_conf), 2)
    }
