import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Copy, Check, ExternalLink } from 'lucide-react';

export default function SourceCard({ source, index, isHighlighted = false, onViewPassage }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const matchPercent = Math.round((source.score || 0) * 100);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(source.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCardClick = () => {
    if (onViewPassage) {
      onViewPassage(source, index + 1);
    }
  };

  return (
    <div
      className={`source-card ${isHighlighted ? 'highlighted' : ''}`}
      id={`source-card-${source.source_id || index}`}
      onClick={handleCardClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="source-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="citation-tag">#{index + 1}</span>
          <span className="source-title" title={source.document_title}>
            {source.document_title}
          </span>
        </div>
        <span className="score-badge" title="Vector cosine similarity relevance score">
          {matchPercent}% Match
        </span>
      </div>

      <div className="source-meta-row">
        <span>Chunk #{source.chunk_index}</span>
        {source.metadata?.word_count && (
          <span>• {source.metadata.word_count} words</span>
        )}
      </div>

      <div className="source-snippet">
        <p style={{
          display: '-webkit-box',
          WebkitLineClamp: expanded ? 'unset' : '3',
          WebkitBoxOrient: 'vertical',
          overflow: expanded ? 'visible' : 'hidden'
        }}>
          {source.content}
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.6rem', alignItems: 'center', gap: '0.4rem' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onViewPassage) onViewPassage(source, index + 1);
          }}
          className="btn btn-primary btn-sm"
          style={{ padding: '0.25rem 0.6rem', fontSize: '0.74rem' }}
          id={`view-passage-btn-${index}`}
          title="Open original passage with text highlights"
        >
          <ExternalLink size={12} />
          <span>View Passage</span>
        </button>

        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
            id={`toggle-expand-src-${index}`}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span>{expanded ? 'Less' : 'More'}</span>
          </button>

          <button
            onClick={handleCopy}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
            id={`copy-src-${index}`}
            title="Copy snippet text"
          >
            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}
