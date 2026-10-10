import os
from typing import Optional
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

from dotenv import load_dotenv

# Find .env in backend/ or root
base_backend_dir = Path(__file__).resolve().parent.parent
env_file_path = base_backend_dir / ".env"
if env_file_path.exists():
    load_dotenv(env_file_path, override=True)

class Settings(BaseSettings):
    PROJECT_NAME: str = "Verified Answers"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database: SQLite default for instant zero-config running, or PostgreSQL with pgvector
    DATABASE_URL: str = "sqlite:///./verified_answers.db"

    # Security & JWT
    SECRET_KEY: str = "super-secret-key-verified-answers-production-replace-me-32b"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # OpenAI Settings (for Reasoning & Answer Synthesis)
    OPENAI_API_KEY: str = ""
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"
    OPENAI_BASE_URL: Optional[str] = None

    # NVIDIA / Llama Settings (for Retrieval & Embeddings)
    NVIDIA_API_KEY: str = ""
    NVIDIA_EMBED_MODEL: str = "nvidia/llama-nemotron-embed-vl-1b-v2"
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"

    # Google Gemini AI Settings (Backward Compatibility / Fallback)
    GEMINI_API_KEY: str = ""
    GEMINI_EMBEDDING_MODEL: str = "models/text-embedding-004"
    GEMINI_CHAT_MODEL: str = "gemini-1.5-flash"

    # Ingestion & RAG
    UPLOAD_DIR: str = str(base_backend_dir / "uploads")
    REPORTS_DIR: str = str(base_backend_dir / "reports")
    MAX_UPLOAD_SIZE_MB: int = 25
    CHUNK_SIZE: int = 600
    CHUNK_OVERLAP: int = 100
    SIMILARITY_THRESHOLD: float = 0.45
    TOP_K_SOURCES: int = 5


    model_config = SettingsConfigDict(
        env_file=str(env_file_path) if env_file_path.exists() else None,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()

