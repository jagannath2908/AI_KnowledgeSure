import re
import json
import logging
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)

GRAPH_EXTRACTION_PROMPT = """You are an expert Knowledge Graph architect.
Analyze the following user question, the grounded answer, and the evidence document chunks.
Extract a MULTI-HOP Knowledge Graph that traces the reasoning path from the user's question to the final answer across the evidence chunks.

REQUIREMENTS:
1. Nodes:
   - "id": A concise unique string (e.g., "query_node", "uipath_studiox", "control_flow", "if_activity")
   - "label": Clear human-readable name (e.g., "UiPath StudioX", "Control Flow Demo", "If Activity")
   - "type": One of ["query", "document", "concept", "action", "outcome"]
   - "description": 1-sentence explanation of this node's role in the context
   - "chunk_index": Integer chunk number where this entity appears (or null)

2. Multi-Hop Edges:
   - "source": node id
   - "target": node id
   - "relation": Action or relationship verb phrase (e.g., "searches for", "demonstrates", "executes", "contains", "outputs to")
   - "hop_order": Integer 1 for Hop 1 (query -> primary concept), 2 for Hop 2 (primary -> actions/steps), 3 for Hop 3 (actions -> result/outcome)

Output ONLY a JSON object:
{
  "nodes": [ ... ],
  "edges": [ ... ],
  "hops_count": 3
}
"""

def extract_rule_based_knowledge_graph(query: str, sources: List[Dict[str, Any]], answer: str) -> Dict[str, Any]:
    """Generates an accurate multi-hop graph using NLP parsing when API latency or quota occurs."""
    nodes = [
        {
            "id": "query_node",
            "label": f"Inquiry: {query[:35]}..." if len(query) > 35 else f"Inquiry: {query}",
            "type": "query",
            "description": "User question initiating the multi-hop reasoning path",
            "chunk_index": None
        }
    ]
    edges = []

    # Identify primary document node
    doc_title = sources[0].get("document_title", "Knowledge Document") if sources else "Knowledge Document"
    doc_node_id = "doc_main"
    nodes.append({
        "id": doc_node_id,
        "label": doc_title,
        "type": "document",
        "description": "Primary ingested source document providing verified evidence",
        "chunk_index": sources[0].get("chunk_index") if sources else 1
    })
    edges.append({
        "source": "query_node",
        "target": doc_node_id,
        "relation": "retrieves context from",
        "hop_order": 1
    })

    # Extract capitalized technical terms / quoted phrases / entities
    all_text = " ".join([s.get("content", "") for s in sources]) + " " + answer
    
    # Common activity and concept patterns in lab manuals and technical docs
    patterns = [
        r"(?:UiPath|StudioX|Studio)",
        r"(?:ControlFlowDemo|Blank Task|New Project)",
        r"(?:If activity|Switch activity|Repeat Number Of Times|Skip Current|Exit Loop)",
        r"(?:Write Line|Message Box|Input Dialog|Modify Text|Text to Left/Right|Delay)",
        r"(?:Experiment \d+|Exercise \d+|\d+\.\s+[A-Z][a-zA-Z\s]+)",
        r"(?:Get Attribute|Extract Table Data|Application/Browser)"
    ]

    discovered = []
    for pat in patterns:
        matches = re.findall(pat, all_text, re.IGNORECASE)
        for m in matches:
            clean = m.strip().rstrip(".,:")
            if len(clean) > 2 and clean.lower() not in [d.lower() for d in discovered]:
                discovered.append(clean)

    if not discovered:
        # Fallback keyword extraction
        words = [w for w in re.findall(r"\b[A-Z][a-zA-Z0-9_-]+\b", all_text) if len(w) > 3][:6]
        discovered.extend(words)

    # Build Multi-Hop Chain
    # Hop 1: Document -> Main Theme/Experiment
    main_concept = discovered[0] if discovered else "Demonstrated Concepts"
    concept_id = "concept_primary"
    nodes.append({
        "id": concept_id,
        "label": main_concept,
        "type": "concept",
        "description": "Primary subject identified in retrieved sources",
        "chunk_index": sources[0].get("chunk_index", 1) if sources else 1
    })
    edges.append({
        "source": doc_node_id,
        "target": concept_id,
        "relation": "defines & outlines",
        "hop_order": 1
    })

    # Hop 2: Main Theme -> Specific Component / Step Activities
    sub_entities = discovered[1:5]
    prev_id = concept_id
    for idx, entity in enumerate(sub_entities, 2):
        entity_id = f"entity_{idx}"
        nodes.append({
            "id": entity_id,
            "label": entity,
            "type": "action" if any(k in entity.lower() for k in ["activity", "project", "loop", "task"]) else "concept",
            "description": f"Key component executed under {main_concept}",
            "chunk_index": sources[min(idx - 1, len(sources) - 1)].get("chunk_index", 1) if sources else 1
        })
        edges.append({
            "source": prev_id,
            "target": entity_id,
            "relation": "implements / executes" if idx > 2 else "demonstrates",
            "hop_order": 2
        })
        prev_id = entity_id

    # Hop 3: Final verified outcome node
    outcome_id = "outcome_node"
    nodes.append({
        "id": outcome_id,
        "label": "Verified Synthesized Answer",
        "type": "outcome",
        "description": "Grounded answer synthesized across multi-hop evidence",
        "chunk_index": None
    })
    edges.append({
        "source": prev_id,
        "target": outcome_id,
        "relation": "synthesizes into",
        "hop_order": 3
    })

    return {
        "nodes": nodes,
        "edges": edges,
        "hops_count": 3
    }

def build_multi_hop_knowledge_graph(
    query: str,
    sources: List[Dict[str, Any]],
    answer: str
) -> Dict[str, Any]:
    """
    Extracts an interconnected multi-hop knowledge graph from query, sources, and answer.
    Uses Gemini LLM with structured JSON or falls back to robust rule extraction.
    """
    if not sources:
        return {
            "nodes": [
                {"id": "query", "label": query, "type": "query", "description": "User question", "chunk_index": None}
            ],
            "edges": [],
            "hops_count": 0
        }

    # Prepare context
    sources_text = "\n\n".join([
        f"Chunk #{s.get('chunk_index')} ({s.get('document_title')}):\n{s.get('content')}"
        for s in sources[:4]
    ])

    user_prompt = f"""USER QUESTION:
{query}

GROUNDED ANSWER:
{answer}

EVIDENCE SOURCES:
{sources_text}

Generate the Multi-Hop Knowledge Graph JSON with nodes and multi-hop edges.
"""
    # Ultra-fast local NLP knowledge graph extraction (eliminates redundant 15s second LLM call)
    return extract_rule_based_knowledge_graph(query, sources, answer)

    if not settings.OPENAI_API_KEY and not settings.GEMINI_API_KEY:
        return extract_rule_based_knowledge_graph(query, sources, answer)

    # 1. Try OpenAI if configured
    if settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            base_url = settings.OPENAI_BASE_URL
            if not base_url and settings.OPENAI_API_KEY.startswith("nvapi-"):
                base_url = "https://integrate.api.nvidia.com/v1"

            client = OpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=base_url
            )
            fmt = None if settings.OPENAI_API_KEY.startswith("nvapi-") else {"type": "json_object"}
            try:
                response = client.chat.completions.create(
                    model=settings.OPENAI_CHAT_MODEL,
                    messages=[
                        {"role": "system", "content": GRAPH_EXTRACTION_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format=fmt,
                    temperature=0.1
                )
            except Exception:
                response = client.chat.completions.create(
                    model=settings.OPENAI_CHAT_MODEL,
                    messages=[
                        {"role": "system", "content": GRAPH_EXTRACTION_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.1
                )

            raw_text = response.choices[0].message.content.strip()
            # Clean markdown codeblocks if present
            clean_text = raw_text
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            if clean_text.startswith("```"):
                clean_text = clean_text[3:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            clean_text = clean_text.strip()

            data = json.loads(clean_text)
            if "nodes" in data and "edges" in data and len(data["nodes"]) >= 2:
                return data
            return extract_rule_based_knowledge_graph(query, sources, answer)
        except Exception as e:
            logger.warning(f"OpenAI Knowledge Graph extraction fallback: {e}")
            if not settings.GEMINI_API_KEY:
                return extract_rule_based_knowledge_graph(query, sources, answer)

    # 2. Try Gemini if configured
    if settings.GEMINI_API_KEY:
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(
                model_name=settings.GEMINI_CHAT_MODEL,
                system_instruction=GRAPH_EXTRACTION_PROMPT,
                generation_config={"response_mime_type": "application/json"}
            )
            response = model.generate_content(user_prompt)
            raw_text = response.text.strip()
            
            # Clean markdown codeblocks if present
            clean_text = raw_text
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            if clean_text.startswith("```"):
                clean_text = clean_text[3:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            clean_text = clean_text.strip()

            data = json.loads(clean_text)
            if "nodes" in data and "edges" in data and len(data["nodes"]) >= 2:
                return data
            return extract_rule_based_knowledge_graph(query, sources, answer)
        except Exception as e:
            logger.warning(f"Gemini Knowledge Graph extraction fallback: {e}")
            return extract_rule_based_knowledge_graph(query, sources, answer)

    return extract_rule_based_knowledge_graph(query, sources, answer)
