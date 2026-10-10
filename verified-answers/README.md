# Verified Answers - Grounded Enterprise Q&A System

Verified Answers is a production-grade, enterprise Retrieval-Augmented Generation (RAG) platform built with FastAPI, PostgreSQL (pgvector), Google Gemini, and React. It delivers verifiable, cited, and auditable answers strictly grounded in your organization's ingested documents.

## Key Features

- **Document Ingestion & Chunking**: Automatic text extraction from PDF, DOCX, TXT, and Markdown with recursive chunking and metadata preservation.
- **Semantic Vector Search**: pgvector-powered cosine similarity retrieval with Gemini embeddings (`text-embedding-004`).
- **Grounded LLM Synthesis**: Strict context-grounded response generation using `gemini-1.5-flash` with zero-hallucination guardrails and confidence scoring.
- **Verifiable Citations**: Every claim is tagged with clickable source citations referencing exact document snippets, chunk indices, and relevance scores.
- **Audit & Export Reports**: Generate downloadable markdown and PDF verification reports containing the full provenance trail.
- **Role-Based Access Control**: JWT authentication with `admin` (document ingestion and knowledge base management) and `user` (conversational Q&A) roles.
- **Modern UI**: React 18 frontend with sleek dark-mode glassmorphism, responsive drawer for sources, and instant document management.

## Project Structure

```
verified-answers/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI application & lifecycle
│   │   ├── config.py               # Settings & environment variables
│   │   ├── database.py             # PostgreSQL & pgvector connection
│   │   ├── models.py               # SQLAlchemy database models
│   │   ├── schemas.py              # Pydantic schemas for requests/responses
│   │   ├── security.py             # Password hashing and JWT generation
│   │   ├── dependencies.py         # DB session, auth, and role guards
│   │   ├── routers/
│   │   │   ├── auth.py             # User registration & JWT login
│   │   │   ├── documents.py        # Admin document upload & indexing
│   │   │   └── chat.py             # Grounded chat & report generation
│   │   └── services/
│   │       ├── ingestion.py        # File extraction, chunking, and embeddings
│   │       ├── retrieval.py        # pgvector vector search & filtering
│   │       ├── answer.py           # Gemini grounded synthesis & citations
│   │       └── reporting.py        # Exportable verification audit reports
│   ├── uploads/                    # Document storage directory
│   ├── tests/                      # Unit & integration tests
│   ├── requirements.txt            # Python dependencies
│   ├── docker-compose.yml          # PostgreSQL + pgvector container
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js           # Centralized API client
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Header navigation & user status
│   │   │   ├── ProtectedRoute.jsx  # Role-based route guard
│   │   │   └── SourceCard.jsx      # Interactive citation source cards
│   │   ├── pages/
│   │   │   ├── Login.jsx           # Auth portal (Admin / Member demo logins)
│   │   │   ├── AdminDashboard.jsx  # Knowledge base management
│   │   │   └── UserChat.jsx        # Grounded Q&A conversation interface
│   │   ├── App.jsx                 # Routes & global state
│   │   ├── main.jsx                # Application root
│   │   └── styles.css              # Custom design system with glassmorphism
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── .env.example
├── .gitignore
└── README.md
```

## Quick Start

### 1. Backend Setup

```bash
cd verified-answers/backend

# Create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and supply your GEMINI_API_KEY and DATABASE_URL

# Start PostgreSQL with pgvector (using Docker)
docker-compose up -d

# Run FastAPI server
uvicorn app.main:app --reload --port 8000
```

FastAPI will be available at `http://localhost:8000` with Swagger docs at `http://localhost:8000/docs`.

### 2. Frontend Setup

```bash
cd verified-answers/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be running at `http://localhost:5173`.
