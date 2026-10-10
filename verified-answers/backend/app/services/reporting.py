import os
import html
import logging
import datetime
from pathlib import Path
from typing import Dict, Any, List
from app.config import settings

logger = logging.getLogger(__name__)

def ensure_reports_dir():
    Path(settings.REPORTS_DIR).mkdir(parents=True, exist_ok=True)

def get_sources_list(chat_log: Any) -> List[Dict[str, Any]]:
    """Helper to safely extract the list of sources from chat_log, whether stored as dict or list."""
    raw = getattr(chat_log, "sources", None) or []
    if isinstance(raw, dict):
        items = raw.get("sources", [])
    elif isinstance(raw, list):
        items = raw
    else:
        items = []
    return [s for s in items if isinstance(s, dict)]

def generate_markdown_report(chat_log: Any, user_email: str) -> str:
    """Generates an audit-ready Markdown verification report."""
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    confidence_score = chat_log.confidence_score if chat_log.confidence_score is not None else 0.0
    confidence_pct = round(confidence_score * 100, 1)

    sources_md = []
    sources = get_sources_list(chat_log)
    for idx, s in enumerate(sources, 1):
        doc_title = s.get("document_title", "Unknown Document")
        chunk_idx = s.get("chunk_index", "N/A")
        score_pct = round(float(s.get("score") or 0.0) * 100, 1)
        content = str(s.get("content") or "").strip()

        sources_md.append(f"""### [Source {idx}] {doc_title} (Chunk #{chunk_idx})
- **Similarity Match**: {score_pct}%
- **Excerpt**:
> {content}
""")

    sources_section = "\n".join(sources_md) if sources_md else "_No external sources recorded._"

    report_content = f"""# Verification & Provenance Report

**Report ID:** VAR-{chat_log.id:06d}  
**Date Generated:** {timestamp}  
**Auditor / User:** {user_email}  
**Grounding Status:** {"✅ STRICTLY GROUNDED" if chat_log.is_grounded else "⚠️ LOW CONFIDENCE"}  
**Verification Confidence:** {confidence_pct}%  

---

## 1. Original Query
> {chat_log.query}

---

## 2. Grounded Answer
{chat_log.answer}

---

## 3. Cited Evidence & Source Provenance
{sources_section}

---

_Generated automatically by Verified Answers - Enterprise Grounded Intelligence._
"""
    return report_content

def generate_pdf_report(chat_log: Any, user_email: str, file_path: str):
    """Generates an enterprise-styled PDF audit document using ReportLab."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

        ensure_reports_dir()
        doc = SimpleDocTemplate(file_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "TitleStyle",
            parent=styles["Heading1"],
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#0f172a")
        )
        subtitle_style = ParagraphStyle(
            "SubTitleStyle",
            parent=styles["Normal"],
            fontSize=10,
            textColor=colors.HexColor("#64748b")
        )
        h2_style = ParagraphStyle(
            "H2Style",
            parent=styles["Heading2"],
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#1e293b"),
            spaceBefore=12,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            "BodyStyle",
            parent=styles["BodyText"],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#334155")
        )
        source_excerpt = ParagraphStyle(
            "SourceExcerpt",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#475569")
        )

        elements = []

        # Header Title
        elements.append(Paragraph("VERIFIED ANSWERS - AUDIT REPORT", title_style))
        timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        elements.append(Paragraph(html.escape(f"Report ID: VAR-{chat_log.id:06d} | Generated: {timestamp} | Requested by: {user_email}"), subtitle_style))
        elements.append(Spacer(1, 10))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#6366f1"), spaceAfter=15))

        sources = get_sources_list(chat_log)
        confidence_score = chat_log.confidence_score if chat_log.confidence_score is not None else 0.0
        confidence_pct = round(confidence_score * 100, 1)

        # Metadata Table
        data = [
            ["Status", "Strictly Grounded" if chat_log.is_grounded else "Low Confidence"],
            ["Confidence Score", f"{confidence_pct}%"],
            ["Total Evidence Sources", str(len(sources))]
        ]
        t = Table(data, colWidths=[150, 350])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
            ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor("#1e293b")),
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0"))
        ]))
        elements.append(t)
        elements.append(Spacer(1, 15))

        # User Question
        elements.append(Paragraph("1. User Query", h2_style))
        elements.append(Paragraph(html.escape(str(chat_log.query or "")), body_style))
        elements.append(Spacer(1, 10))

        # Grounded Answer
        elements.append(Paragraph("2. Synthesized Grounded Response", h2_style))
        formatted_answer = html.escape(str(chat_log.answer or "")).replace("\n", "<br/>")
        elements.append(Paragraph(formatted_answer, body_style))
        elements.append(Spacer(1, 15))

        # Evidence Sources
        elements.append(Paragraph("3. Verified Source Citations", h2_style))
        if not sources:
            elements.append(Paragraph("No cited sources recorded.", body_style))
        else:
            for idx, s in enumerate(sources, 1):
                doc_title = html.escape(str(s.get("document_title") or "Document"))
                chunk_idx = s.get("chunk_index", "N/A")
                score_pct = round(float(s.get("score") or 0.0) * 100, 1)
                content = html.escape(str(s.get("content") or "")[:350])

                elements.append(Paragraph(f"<b>[Source {idx}]</b> {doc_title} (Chunk #{chunk_idx}) &mdash; <i>Match: {score_pct}%</i>", body_style))
                elements.append(Paragraph(f"&ldquo;{content}...&rdquo;", source_excerpt))
                elements.append(Spacer(1, 6))

        doc.build(elements)
    except Exception as e:
        logger.error(f"Error generating PDF report: {e}", exc_info=True)
        # Fallback to plain text / markdown
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(generate_markdown_report(chat_log, user_email))
