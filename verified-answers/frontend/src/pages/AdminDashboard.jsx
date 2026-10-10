import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle, RefreshCw,
  Trash2, Database, Layers, MessageSquare, ShieldCheck, Download,
  Edit3, Eye, Copy, Check, X, Search, Cpu, GitBranch, AlertTriangle, ArrowRight
} from 'lucide-react';
import { api } from '../api/client';
import ThreeDTiltCard from '../components/ThreeDTiltCard';
import PipelineVisualizerModal from '../components/PipelineVisualizerModal';

export default function AdminDashboard() {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({
    total_documents: 0,
    indexed_documents: 0,
    total_chunks: 0,
    total_queries: 0,
    average_confidence: 0
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reindexingId, setReindexingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [customTitle, setCustomTitle] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Chunk Explorer Modal state
  const [viewingChunksDoc, setViewingChunksDoc] = useState(null);
  const [chunksList, setChunksList] = useState([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [chunkSearch, setChunkSearch] = useState('');
  const [copiedChunkId, setCopiedChunkId] = useState(null);

  // Edit Document Modal state
  const [editingDoc, setEditingDoc] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [updatingTitle, setUpdatingTitle] = useState(false);

  // Duplicate / Similarity Detection Modal state
  const [duplicateModalData, setDuplicateModalData] = useState(null);

  // Indexing Pipeline Visualizer Modal state
  const [pipelineDoc, setPipelineDoc] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [docsData, statsData] = await Promise.all([
        api.listDocuments(),
        api.getSystemStats()
      ]);
      setDocuments(docsData.documents || []);
      setStats(statsData || {});
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load documents' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Pre-check for duplicate/similar document before proceeding
  const handleFileUpload = async (file) => {
    if (!file) return;

    setUploading(true);
    setStatusMessage(null);

    try {
      const chkData = new FormData();
      chkData.append('file', file);
      const chkRes = await api.checkDuplicateDocument(chkData);

      if (chkRes && chkRes.is_similar) {
        setUploading(false);
        setDuplicateModalData({
          file,
          title: customTitle.trim(),
          ...chkRes
        });
        return;
      }
    } catch (chkErr) {
      console.warn('Pre-check notice:', chkErr);
    }

    // Normal upload if no collision
    await executeUpload(file, 'auto', null);
  };

  const handleBatchUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setStatusMessage({
      type: 'info',
      text: `Uploading & indexing ${fileList.length} documents into knowledge base... Please wait.`
    });

    const formData = new FormData();
    fileList.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const res = await api.uploadBatchDocuments(formData);
      if (res.failed > 0 && res.successful > 0) {
        setStatusMessage({
          type: 'warning',
          text: `Batch upload finished: Indexed ${res.successful} documents successfully. ${res.failed} files failed (${res.errors.map(e => e.filename).join(', ')}).`
        });
      } else if (res.failed > 0) {
        setStatusMessage({
          type: 'error',
          text: `Batch upload failed for all ${res.failed} files: ${res.errors.map(e => `${e.filename}: ${e.error}`).join('; ')}`
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: `Successfully uploaded and indexed all ${res.successful} documents. All are now active for search & Q&A retrieval!`
        });
      }
      setCustomTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchData();
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Batch upload failed: ${err.message}` });
    } finally {
      setUploading(false);
    }
  };

  const executeUpload = async (file, action = 'auto', matchedId = null) => {
    setUploading(true);
    setStatusMessage(null);
    const formData = new FormData();
    formData.append('file', file);
    if (customTitle.trim()) {
      formData.append('title', customTitle.trim());
    }
    if (action) {
      formData.append('action', action);
    }
    if (matchedId) {
      formData.append('matched_id', matchedId);
    }

    try {
      const doc = await api.uploadDocument(formData);
      const actionNotice = action === 'replace'
        ? `replaced and re-indexed (v${doc.version || 1})`
        : action === 'new_version'
        ? `persisted as new version (v${doc.version || 2})`
        : `uploaded and indexed`;

      setStatusMessage({
        type: 'success',
        text: `Document "${doc.title}" ${actionNotice} successfully.`
      });
      setCustomTitle('');
      setDuplicateModalData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchData();
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Upload failed: ${err.message}` });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This will permanently delete all vector chunks.`)) {
      return;
    }

    try {
      await api.deleteDocument(docId);
      setStatusMessage({ type: 'success', text: `Document "${title}" removed from knowledge base.` });
      await fetchData();
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Failed to delete document: ${err.message}` });
    }
  };

  const handleReindex = async (docId) => {
    setReindexingId(docId);
    try {
      await api.reindexDocument(docId);
      setStatusMessage({ type: 'success', text: 'Document re-chunked and re-indexed successfully.' });
      await fetchData();
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Re-indexing failed: ${err.message}` });
    } finally {
      setReindexingId(null);
    }
  };

  // Open Chunk Explorer Modal
  const handleOpenChunks = async (doc) => {
    setViewingChunksDoc(doc);
    setLoadingChunks(true);
    setChunkSearch('');
    try {
      const chunks = await api.getDocumentChunks(doc.id);
      setChunksList(chunks || []);
    } catch (err) {
      alert(`Failed to load chunks: ${err.message}`);
    } finally {
      setLoadingChunks(false);
    }
  };

  // Edit Document Title Modal
  const handleOpenEdit = (doc) => {
    setEditingDoc(doc);
    setEditTitle(doc.title);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editTitle.trim() || !editingDoc) return;

    setUpdatingTitle(true);
    try {
      await api.updateDocument(editingDoc.id, editTitle.trim());
      setStatusMessage({ type: 'success', text: `Document renamed to "${editTitle.trim()}".` });
      setEditingDoc(null);
      await fetchData();
    } catch (err) {
      alert(`Failed to update document: ${err.message}`);
    } finally {
      setUpdatingTitle(false);
    }
  };

  const handleCopyChunk = (chunkId, content) => {
    navigator.clipboard.writeText(content);
    setCopiedChunkId(chunkId);
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

  const handleDownloadFile = async (doc) => {
    try {
      await api.downloadDocument(doc.id, doc.filename);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Filter chunks by search term
  const filteredChunks = chunksList.filter(c =>
    !chunkSearch.trim() ||
    c.content.toLowerCase().includes(chunkSearch.toLowerCase()) ||
    `chunk #${c.chunk_index}`.toLowerCase().includes(chunkSearch.toLowerCase())
  );

  return (
    <div className="admin-layout" id="admin-dashboard-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem' }}>Knowledge Base Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Upload, modify, update corporate documents and inspect indexed vector chunks.
          </p>
        </div>
        <button
          onClick={fetchData}
          id="refresh-docs-btn"
          className="btn btn-secondary btn-sm"
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {statusMessage && (
        <div className={`banner-alert ${statusMessage.type}`} id="admin-status-alert">
          {statusMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 3D Interactive Metric Cards */}
      <div className="stats-grid">
        <ThreeDTiltCard className="glass-panel stat-card" id="stat-card-docs">
          <div className="stat-icon">
            <Database size={24} />
          </div>
          <div className="stat-info">
            <h4>Total Documents</h4>
            <div className="stat-number">{stats.total_documents}</div>
          </div>
        </ThreeDTiltCard>

        <ThreeDTiltCard className="glass-panel stat-card" id="stat-card-chunks">
          <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4' }}>
            <Layers size={24} />
          </div>
          <div className="stat-info">
            <h4>Indexed Chunks</h4>
            <div className="stat-number">{stats.total_chunks}</div>
          </div>
        </ThreeDTiltCard>

        <ThreeDTiltCard className="glass-panel stat-card" id="stat-card-queries">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <MessageSquare size={24} />
          </div>
          <div className="stat-info">
            <h4>Verified Queries</h4>
            <div className="stat-number">{stats.total_queries}</div>
          </div>
        </ThreeDTiltCard>

        <ThreeDTiltCard className="glass-panel stat-card" id="stat-card-grounding">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            <ShieldCheck size={24} />
          </div>
          <div className="stat-info">
            <h4>Avg Grounding Score</h4>
            <div className="stat-number">{Math.round((stats.average_confidence || 0) * 100)}%</div>
          </div>
        </ThreeDTiltCard>
      </div>

      {/* 3D Upload Zone */}
      <ThreeDTiltCard maxTilt={3} scale={1.005} className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Upload New Knowledge Document</h3>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input
            type="text"
            id="doc-title-input"
            className="form-input"
            placeholder="Document Title (Optional, defaults to filename)"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
          />
        </div>

        <div
          className={`upload-zone ${isDragOver ? 'dragover' : ''}`}
          id="file-dropzone"
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              const files = Array.from(e.dataTransfer.files);
              if (files.length === 1) {
                handleFileUpload(files[0]);
              } else {
                handleBatchUpload(files);
              }
            }
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            id="hidden-file-input"
            ref={fileInputRef}
            style={{ display: 'none' }}
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,.markdown,.csv,.json,.png,.jpg,.jpeg,.webp,.svg"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const files = Array.from(e.target.files);
                if (files.length === 1) {
                  handleFileUpload(files[0]);
                } else {
                  handleBatchUpload(files);
                }
              }
            }}
          />
          <UploadCloud size={40} className="upload-icon" />
          <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>
            {uploading ? 'Extracting, Chunking & Embedding Multiple Documents...' : 'Click to Browse or Drag Multiple Documents Here'}
          </h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>
            Select or drag multiple files (PDF, DOCX, Markdown, Text, CSV, JSON, PNG, JPG, SVG)
          </p>
        </div>
      </ThreeDTiltCard>

      {/* Document Inventory Table */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Document Management & Chunk Inspector</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1rem' }}>
          View, modify, re-index, delete documents and inspect individual vector chunks.
        </p>

        {documents.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
            <p>No documents uploaded yet. Upload your first PDF or TXT above to populate the knowledge base.</p>
          </div>
        ) : (
          <div className="table-container">
            <table id="documents-table">
              <thead>
                <tr>
                  <th>Title & Version</th>
                  <th>File</th>
                  <th>Size</th>
                  <th>Chunks</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} id={`doc-row-${doc.id}`}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={16} color="var(--accent-primary)" />
                        <span>{doc.title}</span>
                        <span className="version-badge" title={`Document Version ${doc.version || 1}`}>
                          v{doc.version || 1}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{doc.filename}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{formatFileSize(doc.file_size)}</td>
                    <td>
                      <button
                        onClick={() => handleOpenChunks(doc)}
                        className="citation-tag"
                        style={{ cursor: 'pointer', border: '1px solid var(--accent-primary)', padding: '0.2rem 0.5rem' }}
                        title="Click to view chunks"
                        id={`view-chunks-badge-${doc.id}`}
                      >
                        <Layers size={11} style={{ display: 'inline', marginRight: 4 }} />
                        {doc.chunk_count} chunks
                      </button>
                    </td>
                    <td>
                      <span className={`status-badge ${doc.status}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {/* Indexing Pipeline Visualizer */}
                        <button
                          onClick={() => setPipelineDoc(doc)}
                          id={`view-pipeline-btn-${doc.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ borderColor: 'rgba(6, 182, 212, 0.4)' }}
                          title="Show How It Indexes the Contents"
                        >
                          <Cpu size={13} color="#06b6d4" />
                          <span>Pipeline</span>
                        </button>

                        {/* View Chunks */}
                        <button
                          onClick={() => handleOpenChunks(doc)}
                          id={`view-chunks-btn-${doc.id}`}
                          className="btn btn-secondary btn-sm"
                          title="Inspect Chunks"
                        >
                          <Eye size={13} />
                          <span>Chunks</span>
                        </button>

                        {/* Download Document File */}
                        <button
                          onClick={() => handleDownloadFile(doc)}
                          id={`download-doc-${doc.id}`}
                          className="btn btn-secondary btn-sm"
                          title="Download Document File"
                        >
                          <Download size={13} />
                        </button>

                        {/* Edit Title */}
                        <button
                          onClick={() => handleOpenEdit(doc)}
                          id={`edit-doc-${doc.id}`}
                          className="btn btn-secondary btn-sm"
                          title="Modify Document Title"
                        >
                          <Edit3 size={13} />
                        </button>

                        {/* Re-index */}
                        <button
                          onClick={() => handleReindex(doc.id)}
                          id={`reindex-doc-${doc.id}`}
                          className="btn btn-secondary btn-sm"
                          title="Re-chunk and Re-embed"
                          disabled={reindexingId === doc.id}
                        >
                          <RefreshCw size={13} className={reindexingId === doc.id ? 'spin-icon' : ''} />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(doc.id, doc.title)}
                          id={`delete-doc-${doc.id}`}
                          className="btn btn-danger btn-sm"
                          title="Delete Document"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DUPLICATE / SIMILARITY COLLISION RESOLUTION MODAL */}
      {duplicateModalData && (
        <div className="modal-backdrop" onClick={() => setDuplicateModalData(null)} style={{ zIndex: 1200 }}>
          <div
            className="modal-content similarity-collision-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 640 }}
          >
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(245, 158, 11, 0.35)'
                  }}
                >
                  <AlertTriangle size={22} color="#f59e0b" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
                    {duplicateModalData.diff_type === 'exact_duplicate'
                      ? 'Identical Data Already Retrieved'
                      : 'Similar Content Detected'}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginTop: 2 }}>
                    This knowledge content matches an existing active document in your vector index.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDuplicateModalData(null)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.3rem 0.6rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.25rem 0' }}>
              {/* Match Gauge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                <span>Semantic Content Match</span>
                <strong style={{ color: '#f59e0b', fontSize: '0.92rem' }}>
                  {(duplicateModalData.similarity_score * 100).toFixed(1)}% Match
                </strong>
              </div>
              <div className="similarity-meter-track">
                <div
                  className="similarity-meter-fill"
                  style={{ width: `${Math.min(duplicateModalData.similarity_score * 100, 100)}%` }}
                />
              </div>

              {/* Matched Details */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginBottom: '1.5rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <FileText size={16} color="#38bdf8" />
                  <strong style={{ color: '#fff' }}>{duplicateModalData.matched_document?.title}</strong>
                  <span className="version-badge">v{duplicateModalData.matched_document?.version || 1}</span>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-dim)', margin: 0 }}>
                  {duplicateModalData.message}
                </p>
              </div>

              <h4 style={{ fontSize: '0.92rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Select Resolution Action:
              </h4>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {/* 1. Replace Old Version */}
                <button
                  type="button"
                  className="diff-choice-btn primary"
                  onClick={() => executeUpload(duplicateModalData.file, 'replace', duplicateModalData.matched_document?.id)}
                  disabled={uploading}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#38bdf8' }}>
                    <RefreshCw size={15} />
                    <span>Replace Old Version</span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    Overwrite old document and re-index vector chunks with the new content.
                  </span>
                </button>

                {/* 2. Keep as New Version */}
                <button
                  type="button"
                  className="diff-choice-btn"
                  onClick={() => executeUpload(duplicateModalData.file, 'new_version', duplicateModalData.matched_document?.id)}
                  disabled={uploading}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#a855f7' }}>
                    <GitBranch size={15} />
                    <span>Keep as New Version (v{(duplicateModalData.matched_document?.version || 1) + 1})</span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    Preserve both versions. Index this update as an incremented version.
                  </span>
                </button>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
              <button
                type="button"
                onClick={() => setDuplicateModalData(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INDEXING PIPELINE VISUALIZER MODAL */}
      {pipelineDoc && (
        <PipelineVisualizerModal
          document={pipelineDoc}
          onClose={() => setPipelineDoc(null)}
        />
      )}

      {/* CHUNKS EXPLORER MODAL */}
      {viewingChunksDoc && (
        <div className="modal-backdrop" onClick={() => setViewingChunksDoc(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860 }}>
            <div className="modal-header">
              <div>
                <h3>
                  <Layers size={20} color="var(--accent-primary)" />
                  <span>Chunk Inspector: {viewingChunksDoc.title}</span>
                </h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: 2 }}>
                  {chunksList.length} indexed chunks from {viewingChunksDoc.filename}
                </p>
              </div>
              <button
                onClick={() => setViewingChunksDoc(null)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.3rem 0.6rem' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Filter Chunks */}
            <div style={{ padding: '0.75rem 1.75rem', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-surface)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <Search size={15} color="var(--text-dim)" />
                <input
                  type="text"
                  placeholder="Filter chunks by content or index (e.g. 'experiment', '#4')..."
                  value={chunkSearch}
                  onChange={(e) => setChunkSearch(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%', fontSize: '0.88rem' }}
                />
                {chunkSearch && (
                  <button onClick={() => setChunkSearch('')} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="modal-body">
              {loadingChunks ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 0.75rem' }} />
                  <p>Loading document chunks...</p>
                </div>
              ) : filteredChunks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                  <p>No chunks match your search query.</p>
                </div>
              ) : (
                filteredChunks.map((chunk) => (
                  <div key={chunk.id} className="chunk-card" id={`chunk-card-${chunk.id}`}>
                    <div className="chunk-card-meta">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="citation-tag" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8' }}>
                          Chunk #{chunk.chunk_index}
                        </span>
                        {chunk.chunk_metadata?.word_count && (
                          <span>{chunk.chunk_metadata.word_count} words</span>
                        )}
                        <span>{chunk.content.length} characters</span>
                      </div>

                      <button
                        onClick={() => handleCopyChunk(chunk.id, chunk.content)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        {copiedChunkId === chunk.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        <span>{copiedChunkId === chunk.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <div style={{ fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
                      {chunk.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="modal-footer">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginRight: 'auto' }}>
                Showing {filteredChunks.length} of {chunksList.length} chunks
              </span>
              <button onClick={() => setViewingChunksDoc(null)} className="btn btn-secondary btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TITLE MODAL */}
      {editingDoc && (
        <div className="modal-backdrop" onClick={() => setEditingDoc(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>
                <Edit3 size={18} color="var(--accent-primary)" />
                <span>Modify Document Title</span>
              </h3>
              <button onClick={() => setEditingDoc(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.6rem' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="edit-title-input">Document Title</label>
                  <input
                    type="text"
                    id="edit-title-input"
                    className="form-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    autoFocus
                  />
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginTop: 4 }}>
                    File: {editingDoc.filename}
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setEditingDoc(null)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={updatingTitle}>
                  {updatingTitle ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
