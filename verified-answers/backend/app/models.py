import json
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base, settings

# Graceful Vector type handling for pgvector or JSON fallback
def is_pgvector_supported() -> bool:
    if "postgresql" not in settings.DATABASE_URL.lower():
        return False
    try:
        from app.database import engine
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
            return True
    except Exception:
        return False

if is_pgvector_supported():
    try:
        from pgvector.sqlalchemy import Vector
        EmbeddingType = Vector()
    except Exception:
        EmbeddingType = JSON
else:
    EmbeddingType = JSON

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="user", nullable=False)  # "admin" | "user"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    documents = relationship("Document", back_populates="uploader", cascade="all, delete-orphan")
    chat_logs = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_size = Column(Integer, default=0)
    mime_type = Column(String(100), default="text/plain")
    status = Column(String(50), default="processing")  # processing, indexed, failed
    error_message = Column(Text, nullable=True)
    chunk_count = Column(Integer, default=0)
    version = Column(Integer, default=1)
    content_hash = Column(String(64), nullable=True)
    indexing_metadata = Column(JSON, default=dict)
    parent_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    uploader = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    chunk_metadata = Column(JSON, default=dict)
    # 768 dimensions for Gemini text-embedding-004
    embedding = Column(EmbeddingType, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("Document", back_populates="chunks")

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    query = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources = Column(JSON, default=list)  # Stored citation metadata & chunks
    confidence_score = Column(Float, default=1.0)
    is_grounded = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="chat_logs")
