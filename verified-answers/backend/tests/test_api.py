import pytest
from app.security import hash_password, verify_password, create_access_token, decode_access_token
from app.services.ingestion import chunk_text, generate_mock_embedding
from app.services.retrieval import cosine_similarity
from app.services.reporting import generate_markdown_report

def test_password_hashing():
    pwd = "EnterpriseSecret123!"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword", hashed) is False

def test_jwt_token_cycle():
    payload = {"sub": "42", "email": "auditor@example.com", "role": "admin"}
    token = create_access_token(payload)
    assert isinstance(token, str)
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "42"
    assert decoded["email"] == "auditor@example.com"
    assert decoded["role"] == "admin"

def test_chunk_text():
    sample_text = (
        "Paragraph 1 contains some important corporate policy details. "
        "Every employee must comply with data privacy regulations.\n\n"
        "Paragraph 2 discusses cryptographic standards. RSA and ECC keys "
        "must be rotated periodically according to compliance schedules.\n\n"
        "Paragraph 3 outlines customer support escalation procedures."
    )
    chunks = chunk_text(sample_text, chunk_size=120, overlap=20)
    assert len(chunks) >= 2
    assert all(len(c) > 0 for c in chunks)

def test_embedding_and_similarity():
    emb1 = generate_mock_embedding("Quantum computing and encryption")
    emb2 = generate_mock_embedding("Quantum computing and encryption")
    emb3 = generate_mock_embedding("Cooking Italian pasta recipes")

    sim_identical = cosine_similarity(emb1, emb2)
    sim_different = cosine_similarity(emb1, emb3)

    assert round(sim_identical, 2) == 1.00
    assert sim_different < 0.99

def test_markdown_report_formatting():
    class MockChatLog:
        id = 101
        query = "What is the key rotation policy?"
        answer = "Keys must be rotated every 90 days [Source 1]."
        confidence_score = 0.95
        is_grounded = True
        sources = [
            {
                "document_title": "Security Handbook",
                "chunk_index": 2,
                "score": 0.94,
                "content": "All cryptographic keys must be rotated every 90 days."
            }
        ]

    md = generate_markdown_report(MockChatLog(), "auditor@company.com")
    assert "VAR-000101" in md
    assert "Security Handbook" in md
    assert "95.0%" in md
    assert "What is the key rotation policy?" in md
