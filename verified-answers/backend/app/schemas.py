from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field

try:
    import email_validator
    from pydantic import EmailStr
except ImportError:
    EmailStr = str


# ----------------- Auth Schemas -----------------

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)
    role: Optional[str] = Field(default="user", pattern="^(admin|user)$")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ----------------- Document Schemas -----------------

class DocumentChunkResponse(BaseModel):
    id: int
    chunk_index: int
    content: str
    chunk_metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: int
    title: str
    filename: str
    file_size: int
    mime_type: str
    status: str
    error_message: Optional[str] = None
    chunk_count: int
    version: Optional[int] = 1
    content_hash: Optional[str] = None
    indexing_metadata: Optional[Dict[str, Any]] = None
    parent_id: Optional[int] = None
    uploaded_by: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int

class BatchUploadError(BaseModel):
    filename: str
    error: str

class BatchUploadResponse(BaseModel):
    total: int
    successful: int
    failed: int
    documents: List[DocumentResponse]
    errors: List[BatchUploadError]

class MatchedDocInfo(BaseModel):
    id: int
    title: str
    version: int = 1
    filename: str

class DuplicateCheckResponse(BaseModel):
    is_similar: bool
    similarity_score: float = 0.0
    diff_type: str = "none"  # "exact_duplicate", "minor_change", "none"
    matched_document: Optional[MatchedDocInfo] = None
    message: Optional[str] = None

class PipelineStepMetric(BaseModel):
    step: int
    name: str
    status: str
    description: str
    duration_ms: int
    metrics: Dict[str, Any]

class PipelineResponse(BaseModel):
    document_id: int
    title: str
    version: int
    status: str
    total_duration_ms: int
    indexed_at: Optional[str] = None
    pipeline_steps: List[PipelineStepMetric]

# ----------------- Chat & Retrieval Schemas -----------------

class SourceItem(BaseModel):
    source_id: int
    document_id: int
    document_title: str
    chunk_index: int
    content: str
    score: float
    metadata: Optional[Dict[str, Any]] = None

class GraphNode(BaseModel):
    id: str
    label: str
    type: str = "entity"  # "query" | "entity" | "action" | "concept" | "document"
    description: Optional[str] = None
    chunk_index: Optional[int] = None

class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str
    hop_order: int = 1

class KnowledgeGraphData(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    hops_count: int = 1

class ChatQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=2000)
    top_k: Optional[int] = Field(default=5, ge=1, le=20)
    threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)

class ChatQueryResponse(BaseModel):
    id: int
    query: str
    answer: str
    confidence_score: float
    is_grounded: bool
    sources: List[SourceItem]
    reasoning_steps: Optional[List[str]] = None
    knowledge_graph: Optional[KnowledgeGraphData] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatHistoryResponse(BaseModel):
    items: List[ChatQueryResponse]
    total: int

# ----------------- Reporting Schemas -----------------

class ReportExportRequest(BaseModel):
    chat_id: int
    format: str = Field(default="markdown", pattern="^(markdown|pdf)$")

class ReportExportResponse(BaseModel):
    chat_id: int
    format: str
    filename: str
    content: Optional[str] = None
    download_url: Optional[str] = None
