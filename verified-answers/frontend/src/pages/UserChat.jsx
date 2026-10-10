import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Sparkles, ShieldCheck, Download, Trash2,
  FileDown, BookOpen, AlertCircle, CornerDownLeft,
  ExternalLink, X, Copy, Check, Search, FileText,
  Network, ChevronDown, ChevronUp, GitBranch
} from 'lucide-react';
import { api } from '../api/client';
import SourceCard from '../components/SourceCard';
import KnowledgeGraph from '../components/KnowledgeGraph';


export default function UserChat() {
  const [messages, setMessages] = useState([]);
  const [currentSources, setCurrentSources] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [highlightedSourceId, setHighlightedSourceId] = useState(null);
  const [exportingId, setExportingId] = useState(null);

  // Original Passage Reader Modal state
  const [activePassage, setActivePassage] = useState(null);
  const [passageSearchFilter, setPassageSearchFilter] = useState('');
  const [copiedPassage, setCopiedPassage] = useState(false);

  // Reasoning & Multi-Hop Knowledge Graph accordion state
  const [expandedReasoning, setExpandedReasoning] = useState({});
  const [expandedGraph, setExpandedGraph] = useState({});

  const toggleReasoning = (id) => {
    setExpandedReasoning(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleGraph = (id) => {
    setExpandedGraph(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const messagesEndRef = useRef(null);


  const sampleQuestions = [
    "which is my second experiment",
    "what is the second experiment all about",
    "what activities are demonstrated in UiPath StudioX",
    "what are the key steps in the lab manual"
  ];

  const fetchHistory = async () => {
    try {
      const data = await api.getChatHistory(20);
      const items = (data.items || []).reverse();
      setMessages(items);
      if (items.length > 0) {
        setCurrentSources(items[items.length - 1].sources || []);
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (questionText = null) => {
    const q = (questionText || query).trim();
    if (!q || loading) return;

    setQuery('');
    setLoading(true);

    // Optimistic user message representation
    const tempUserMsg = {
      id: Date.now(),
      query: q,
      answer: null,
      confidence_score: null,
      is_grounded: null,
      sources: []
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const response = await api.queryChat(q);
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMsg.id),
        response
      ]);
      setCurrentSources(response.sources || []);
    } catch (err) {
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMsg.id),
        {
          id: Date.now(),
          query: q,
          answer: `Error answering query: ${err.message}`,
          confidence_score: 0.0,
          is_grounded: false,
          sources: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Clear all past verified queries and answers?")) return;
    try {
      await api.clearChatHistory();
      setMessages([]);
      setCurrentSources([]);
    } catch (err) {
      alert("Failed to clear history: " + err.message);
    }
  };

  const handleDownload = async (chatId, format) => {
    setExportingId(chatId);
    try {
      await api.downloadReport(chatId, format);
    } catch (err) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExportingId(null);
    }
  };

  // Open Passage Inspector Modal
  const openPassageModal = (source, citationNumber, queryText = '') => {
    setActivePassage({
      source,
      citationNumber,
      queryText
    });
    setPassageSearchFilter('');
    setCopiedPassage(false);
  };

  const handleCitationClick = (sourceIndex, msgQuery) => {
    const targetSource = currentSources[sourceIndex - 1];
    if (targetSource) {
      setHighlightedSourceId(targetSource.source_id);
      const element = document.getElementById(`source-card-${targetSource.source_id || (sourceIndex - 1)}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Open the original passage modal with highlights
      openPassageModal(targetSource, sourceIndex, msgQuery);

      setTimeout(() => setHighlightedSourceId(null), 3000);
    }
  };

  const handleCopyPassage = (content) => {
    navigator.clipboard.writeText(content);
    setCopiedPassage(true);
    setTimeout(() => setCopiedPassage(false), 2000);
  };

  // Helper to highlight key query terms & filter keywords inside original passage
  const renderHighlightedPassage = (content, queryText, filterText) => {
    if (!content) return null;

    // Collect terms to highlight
    const terms = new Set();

    // 1. User interactive filter
    if (filterText && filterText.trim().length > 1) {
      terms.add(filterText.trim());
    }

    // 2. Query keywords (exclude common stop words)
    const stopWords = new Set(["what", "is", "the", "about", "all", "which", "my", "in", "it", "to", "for", "a", "an", "and", "of", "from", "are", "do", "how"]);
    if (queryText) {
      const words = queryText.toLowerCase().match(/\b[a-z0-9_-]{2,}\b/g) || [];
      words.forEach(w => {
        if (!stopWords.has(w)) {
          terms.add(w);
        }
      });
    }

    if (terms.size === 0) {
      return content;
    }

    // Sort terms longest first to avoid partial word collisions
    const sortedTerms = Array.from(terms).sort((a, b) => b.length - a.length);
    const regexPattern = sortedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${regexPattern})`, 'gi');

    const parts = content.split(regex);
    return parts.map((part, idx) => {
      if (regex.test(part)) {
        // Highlighted mark
        const isExactFilter = filterText && part.toLowerCase() === filterText.trim().toLowerCase();
        return (
          <mark
            key={idx}
            className={`passage-highlight ${isExactFilter ? 'passage-highlight-exact' : ''}`}
          >
            {part}
          </mark>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  // Render answer with interactive clickable citation badges
  const renderFormattedAnswer = (text, msgQuery) => {
    if (!text) return null;
    const parts = text.split(/(\[Source \d+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/\[Source (\d+)\]/);
      if (match) {
        const sourceNum = parseInt(match[1], 10);
        return (
          <button
            key={i}
            className="citation-tag"
            onClick={() => handleCitationClick(sourceNum, msgQuery)}
            title={`Click to open original passage for [Source ${sourceNum}] with highlighted evidence`}
            id={`citation-tag-${sourceNum}-${i}`}
          >
            [Source {sourceNum}]
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="chat-layout" id="user-chat-page">
      {/* Main Conversation Column */}
      <div className="chat-main">
        <div className="chat-header">
          <div className="chat-header-info">
            <h2>
              <ShieldCheck size={22} color="var(--accent-cyan)" />
              <span>Grounded Intelligence Q&A</span>
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Ask questions strictly grounded in your organization's documents. Click citations to view original highlighted passages.
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              id="clear-chat-history-btn"
              className="btn btn-secondary btn-sm"
              title="Clear Conversation"
            >
              <Trash2 size={14} />
              <span>Clear</span>
            </button>
          )}
        </div>

        <div className="chat-messages" id="chat-messages-container">
          {messages.length === 0 ? (
            <div className="empty-chat">
              <div className="empty-chat-icon">
                <Sparkles size={38} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Ask Any Grounded Question</h3>
              <p style={{ fontSize: '0.9rem' }}>
                Every answer is verified against your uploaded documents. When you click any source citation, the original passage opens with the key matching evidence highlighted.
              </p>

              <div className="sample-queries">
                <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-dim)', textAlign: 'left' }}>
                  Suggested queries
                </span>
                {sampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    id={`sample-query-${idx}`}
                    className="sample-query-chip"
                    onClick={() => handleSend(q)}
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <React.Fragment key={msg.id}>
                {/* User Query */}
                <div className="chat-bubble-user" id={`user-msg-${msg.id}`}>
                  {msg.query}
                </div>

                {/* Assistant Answer */}
                {msg.answer ? (
                  <div className="chat-bubble-assistant" id={`assistant-msg-${msg.id}`}>
                    <div className="assistant-meta-bar">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={`grounded-badge ${msg.is_grounded ? 'verified' : 'unverified'}`}>
                          <ShieldCheck size={14} />
                          {msg.is_grounded ? `Verified (${Math.round(msg.confidence_score * 100)}% Grounded)` : 'Low Grounding Confidence'}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                          {msg.sources?.length || 0} Evidence Chunks
                        </span>
                      </div>

                      {/* Export buttons */}
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => handleDownload(msg.id, 'markdown')}
                          className="btn btn-secondary btn-sm"
                          id={`export-md-btn-${msg.id}`}
                          title="Export Markdown Audit Report"
                          disabled={exportingId === msg.id}
                        >
                          <Download size={13} />
                          <span>MD Report</span>
                        </button>
                        <button
                          onClick={() => handleDownload(msg.id, 'pdf')}
                          className="btn btn-secondary btn-sm"
                          id={`export-pdf-btn-${msg.id}`}
                          title="Export PDF Audit Report"
                          disabled={exportingId === msg.id}
                        >
                          <FileDown size={13} />
                          <span>PDF Report</span>
                        </button>
                      </div>
                    </div>

                    <div className="answer-body">
                      {renderFormattedAnswer(msg.answer, msg.query)}
                    </div>

                    {/* Reasoning Trail & Knowledge Graph Action Bar */}
                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      {msg.reasoning_steps && msg.reasoning_steps.length > 0 && (
                        <button
                          onClick={() => toggleReasoning(msg.id)}
                          className="btn btn-secondary btn-sm"
                          style={{
                            fontSize: '0.78rem',
                            background: expandedReasoning[msg.id] ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-surface)',
                            borderColor: expandedReasoning[msg.id] ? 'var(--accent-primary)' : 'var(--border-subtle)'
                          }}
                          id={`toggle-reasoning-btn-${msg.id}`}
                        >
                          <GitBranch size={13} color="var(--accent-primary)" />
                          <span>{expandedReasoning[msg.id] ? 'Hide Reasoning Trail' : `Reasoning Trail (${msg.reasoning_steps.length} Hops)`}</span>
                          {expandedReasoning[msg.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}

                      {msg.knowledge_graph && msg.knowledge_graph.nodes?.length > 0 && (
                        <button
                          onClick={() => toggleGraph(msg.id)}
                          className="btn btn-secondary btn-sm"
                          style={{
                            fontSize: '0.78rem',
                            background: expandedGraph[msg.id] ? 'rgba(6, 182, 212, 0.2)' : 'var(--bg-surface)',
                            borderColor: expandedGraph[msg.id] ? 'var(--accent-cyan)' : 'var(--border-subtle)'
                          }}
                          id={`toggle-graph-btn-${msg.id}`}
                        >
                          <Network size={13} color="var(--accent-cyan)" />
                          <span>{expandedGraph[msg.id] ? 'Hide Knowledge Graph' : 'Multi-Hop Knowledge Graph'}</span>
                          {expandedGraph[msg.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                    </div>

                    {/* Collapsible Reasoning Steps */}
                    {expandedReasoning[msg.id] && msg.reasoning_steps && (
                      <div style={{ marginTop: '0.75rem', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1.1rem' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <GitBranch size={12} /> Multi-Hop Synthesis Steps
                        </div>
                        <ol style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                          {msg.reasoning_steps.map((step, sIdx) => (
                            <li key={sIdx} style={{ marginBottom: '0.35rem' }}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Collapsible Multi-Hop Knowledge Graph Component */}
                    {expandedGraph[msg.id] && msg.knowledge_graph && (
                      <KnowledgeGraph
                        graphData={msg.knowledge_graph}
                        onOpenPassage={(chunkIdx) => {
                          const targetSrc = (msg.sources || []).find(s => s.chunk_index === chunkIdx) || msg.sources?.[0];
                          if (targetSrc) openPassageModal(targetSrc, 1, msg.query);
                        }}
                      />
                    )}
                  </div>

                ) : (
                  <div className="chat-bubble-assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="spin-icon" style={{ display: 'flex' }}>
                      <Sparkles size={18} color="var(--accent-primary)" />
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      Retrieving relevant chunks & synthesizing grounded response...
                    </span>
                  </div>
                )}
              </React.Fragment>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="chat-input-area">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="chat-input-box"
            id="chat-input-form"
          >
            <input
              type="text"
              id="chat-query-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question grounded in your documents..."
              disabled={loading}
              autoFocus
            />
            <button
              type="submit"
              id="chat-submit-btn"
              className="btn btn-primary btn-sm"
              disabled={loading || !query.trim()}
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              {loading ? (
                <Sparkles size={16} className="spin-icon" />
              ) : (
                <CornerDownLeft size={16} />
              )}
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Citations & Evidence Sidebar */}
      <aside className="sources-sidebar" id="sources-sidebar-drawer">
        <div className="sources-header">
          <h3>
            <BookOpen size={18} color="var(--accent-primary)" />
            <span>Retrieved Sources</span>
          </h3>
          <span className="citation-tag">{currentSources.length} Sources</span>
        </div>

        <div className="sources-list" id="sources-list-container">
          {currentSources.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              <ShieldCheck size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <p>No active citations loaded.</p>
              <p style={{ marginTop: '0.4rem', fontSize: '0.78rem' }}>
                Ask a question to view the exact document passages and similarity match scores retrieved by the AI.
              </p>
            </div>
          ) : (
            currentSources.map((source, idx) => (
              <SourceCard
                key={source.source_id || idx}
                source={source}
                index={idx}
                isHighlighted={highlightedSourceId === source.source_id}
                onViewPassage={(src, num) => {
                  const lastUserMsg = messages.filter(m => m.query).slice(-1)[0]?.query || '';
                  openPassageModal(src, num, lastUserMsg);
                }}
              />
            ))
          )}
        </div>
      </aside>

      {/* ORIGINAL PASSAGE VIEWER MODAL WITH HIGHLIGHTING */}
      {activePassage && (
        <div className="modal-backdrop" onClick={() => setActivePassage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 840 }}>
            <div className="modal-header">
              <div>
                <h3>
                  <FileText size={20} color="var(--accent-cyan)" />
                  <span>Original Document Passage — Source #{activePassage.citationNumber || 1}</span>
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: 4 }}>
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>
                    {activePassage.source.document_title}
                  </span>
                  <span className="citation-tag">
                    Chunk #{activePassage.source.chunk_index}
                  </span>
                  <span className="score-badge">
                    {Math.round((activePassage.source.score || 0) * 100)}% Match
                  </span>
                </div>
              </div>

              <button
                onClick={() => setActivePassage(null)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.3rem 0.6rem' }}
                id="close-passage-modal-btn"
              >
                <X size={16} />
              </button>
            </div>

            {/* In-passage search / filter bar */}
            <div style={{ padding: '0.75rem 1.75rem', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-surface)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <Search size={15} color="var(--accent-cyan)" />
                <input
                  type="text"
                  placeholder="Filter or search in passage to highlight specific keywords..."
                  value={passageSearchFilter}
                  onChange={(e) => setPassageSearchFilter(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%', fontSize: '0.88rem' }}
                />
                {passageSearchFilter && (
                  <button onClick={() => setPassageSearchFilter('')} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  <span>Highlights:</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(6, 182, 212, 0.4)', border: '1px solid #06b6d4' }}></span>
                    Query Evidence
                  </span>
                  {passageSearchFilter && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(16, 185, 129, 0.5)', border: '1px solid #10b981' }}></span>
                      Exact Search
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleCopyPassage(activePassage.source.content)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                  id="copy-passage-btn"
                >
                  {copiedPassage ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  <span>{copiedPassage ? 'Copied' : 'Copy Passage'}</span>
                </button>
              </div>

              {/* The Highlighted Passage */}
              <div className="passage-card" id="passage-card-content">
                {renderHighlightedPassage(
                  activePassage.source.content,
                  activePassage.queryText,
                  passageSearchFilter
                )}
              </div>
            </div>

            <div className="modal-footer">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginRight: 'auto' }}>
                {activePassage.source.content.length} characters • {activePassage.source.content.split(/\s+/).length} words
              </span>
              <button
                onClick={() => setActivePassage(null)}
                className="btn btn-primary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
