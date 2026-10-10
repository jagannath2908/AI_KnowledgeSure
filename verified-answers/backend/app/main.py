import os
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager

# Allow running directly via `python main.py` from either backend/ or backend/app/
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.routers import auth, documents, chat

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager to initialize database and resources."""
    logger.info("Initializing Verified Answers database schema...")
    try:
        init_db()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Error during startup database initialization: {e}")
    yield
    logger.info("Shutting down Verified Answers API.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise Grounded RAG Platform using FastAPI, pgvector, and Google Gemini.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers under /api
app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")

@app.get("/", tags=["Health"])
def root():
    return {
        "name": settings.PROJECT_NAME,
        "status": "online",
        "version": "1.0.0",
        "gemini_chat_model": settings.GEMINI_CHAT_MODEL,
        "gemini_embedding_model": settings.GEMINI_EMBEDDING_MODEL,
        "docs_url": "/docs"
    }

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
