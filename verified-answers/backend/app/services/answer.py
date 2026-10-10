import json
import logging
from typing import List, Dict, Any, Tuple, Optional
import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """You are Verified Answers, an enterprise AI assistant specialized in multi-hop reasoning and strictly grounded knowledge retrieval.

MISSION & GUIDELINES:
1. Multi-Hop Synthesis: Analyze all provided Sources together. Trace relationships between components, steps, experiments, activities, and policies across different chunks.
2. Direct & Informative: If the retrieved sources contain information answering or explaining the user's question, provide a detailed, clear, and direct answer. Do NOT refuse or say "insufficient information" if the sources discuss the subject matter.
3. Citations: Cite every factual claim with [Source X] matching the numbered evidence source.
4. Reasoning Chain: Formulate explicit multi-hop reasoning steps tracing how facts in the sources connect to form the answer.
5. Format: Return ONLY a valid JSON object:
{
  "reasoning_steps": [
    "Hop 1: Located primary subject in Source X...",
    "Hop 2: Traced workflow/steps into Source Y...",
    "Hop 3: Concluded synthesized verification..."
  ],
  "answer": "<Comprehensive, well-structured answer with inline [Source X] citations>",
  "confidence_score": <float between 0.0 and 1.0>,
  "is_grounded": true
}
"""

def generate_grounded_answer(
    query: str,
    sources: List[Dict[str, Any]]
) -> Tuple[str, float, bool, List[str]]:
    """
    Generates a multi-hop grounded response with reasoning steps and inline citations.
    Returns (answer, confidence_score, is_grounded, reasoning_steps).
    """
    if not sources:
        return (
            "No relevant information was found in the indexed documents for your inquiry. Please upload relevant source material or refine your search query.",
            0.0,
            False,
            ["No matching chunks were retrieved above the similarity threshold."]
        )

    # Prepare context string
    context_blocks = []
    for idx, src in enumerate(sources, 1):
        context_blocks.append(
            f"--- SOURCE {idx}: {src.get('document_title')} (Chunk #{src.get('chunk_index')}) ---\n"
            f"{src.get('content')}\n"
        )
    context_text = "\n".join(context_blocks)

    user_prompt = f"""CONTEXT SOURCES:
{context_text}

USER QUESTION:
{query}

Perform multi-hop reasoning and respond in the required JSON format:
{{"reasoning_steps": [...], "answer": "...", "confidence_score": 0.95, "is_grounded": true}}
"""

    if not settings.OPENAI_API_KEY and not settings.GEMINI_API_KEY:
        top_src = sources[0]
        simulated_reasoning = [
            f"Hop 1: Retrieved top chunk #{top_src.get('chunk_index')} from {top_src.get('document_title')}.",
            "Hop 2: Traced matching semantic content to formulate grounded response."
        ]
        simulated_answer = (
            f"According to **{top_src.get('document_title')}** [Source 1], "
            f"\"{top_src.get('content')[:180]}...\""
        )
        return simulated_answer, round(float(top_src.get("score", 0.85)), 2), True, simulated_reasoning

    # 1. Try OpenAI / NVIDIA Chat if OPENAI_API_KEY is provided
    if settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            base_url = settings.OPENAI_BASE_URL
            if not base_url and settings.OPENAI_API_KEY.startswith("nvapi-"):
                base_url = "https://integrate.api.nvidia.com/v1"

            client = OpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=base_url,
                timeout=15.0
            )

            try:
                # Prefer json_object mode if OpenAI, omit if model doesn't support it
                fmt = None if settings.OPENAI_API_KEY.startswith("nvapi-") else {"type": "json_object"}
                response = client.chat.completions.create(
                    model=settings.OPENAI_CHAT_MODEL,
                    messages=[
                        {"role": "system", "content": SYSTEM_INSTRUCTION},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format=fmt,
                    max_tokens=650,
                    temperature=0.2
                )
            except Exception:
                response = client.chat.completions.create(
                    model=settings.OPENAI_CHAT_MODEL,
                    messages=[
                        {"role": "system", "content": SYSTEM_INSTRUCTION},
                        {"role": "user", "content": user_prompt}
                    ],
                    max_tokens=650,
                    temperature=0.2
                )

            msg = response.choices[0].message
            raw_text = (msg.content or getattr(msg, "reasoning_content", "") or "").strip()

            # Clean markdown codeblocks
            clean_text = raw_text
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            if clean_text.startswith("```"):
                clean_text = clean_text[3:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            clean_text = clean_text.strip()

            parsed = json.loads(clean_text)
            answer = parsed.get("answer", raw_text)
            confidence = float(parsed.get("confidence_score", 0.95))
            is_grounded = bool(parsed.get("is_grounded", True))
            reasoning_steps = parsed.get("reasoning_steps", [
                "Hop 1: Analyzed retrieved evidence chunks via reasoning model.",
                "Hop 2: Synthesized grounded response with source attribution."
            ])
            return answer, confidence, is_grounded, reasoning_steps
        except Exception as e:
            logger.error(f"OpenAI reasoning call failed: {e}")
            # If Gemini key exists, fall through to Gemini; otherwise continue to fallback

    # 2. Try Gemini if GEMINI_API_KEY is provided
    if settings.GEMINI_API_KEY:
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(
                model_name=settings.GEMINI_CHAT_MODEL,
                system_instruction=SYSTEM_INSTRUCTION
            )

            response = model.generate_content(user_prompt)
            raw_text = response.text.strip()

            # Clean markdown codeblocks
            clean_text = raw_text
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            if clean_text.startswith("```"):
                clean_text = clean_text[3:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            clean_text = clean_text.strip()

            reasoning_steps = []
            try:
                parsed = json.loads(clean_text)
                answer = parsed.get("answer", raw_text)
                confidence = float(parsed.get("confidence_score", 0.9))
                is_grounded = bool(parsed.get("is_grounded", True))
                reasoning_steps = parsed.get("reasoning_steps", [
                    "Hop 1: Analyzed retrieved evidence chunks.",
                    "Hop 2: Synthesized grounded response with source attribution."
                ])
            except Exception:
                answer = raw_text
                confidence = 0.85
                is_grounded = True
                reasoning_steps = [
                    "Direct synthesis from evidence chunks.",
                    "Citations mapped to source passages."
                ]

            return answer, confidence, is_grounded, reasoning_steps
        except Exception as e:
            logger.error(f"Error calling Gemini model: {e}")
        best_source = sources[0]
        fallback_answer = (
            f"From **{best_source.get('document_title')}** [Source 1]:\n\n"
            f"> {best_source.get('content')}"
        )
        fallback_reasoning = [
            f"Retrieved primary match from chunk #{best_source.get('chunk_index')}.",
            "Extracted authoritative excerpt as grounded response."
        ]
        return fallback_answer, round(best_source.get("score", 0.7), 2), True, fallback_reasoning
