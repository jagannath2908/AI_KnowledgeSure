import React, { useState, useEffect } from 'react';
import {
  X, CheckCircle2, Cpu, FileText, GitBranch, Database,
  Clock, Hash, Sparkles, Layers, Box, ArrowDown
} from 'lucide-react';
import { api } from '../api/client';
import ThreeDTiltCard from './ThreeDTiltCard';

export default function PipelineVisualizerModal({ document, onClose }) {
  const [pipelineData, setPipelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(null);

  useEffect(() => {
    if (!document) return;
    let isMounted = true;
    setLoading(true);

    api.getDocumentPipeline(document.id)
      .then((data) => {
        if (isMounted) {
          setPipelineData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load pipeline metadata:', err);
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [document]);

  if (!document) return null;

  const stageIcons = {
    1: <FileText size={18} color="#38bdf8" />,
    2: <Layers size={18} color="#a855f7" />,
    3: <Cpu size={18} color="#6366f1" />,
    4: <Database size={18} color="#10b981" />
  };

  const stageThemes = {
    1: { border: 'rgba(56, 189, 248, 0.4)', glow: 'rgba(56, 189, 248, 0.15)', badgeBg: 'rgba(56, 189, 248, 0.15)', badgeColor: '#38bdf8' },
    2: { border: 'rgba(168, 85, 247, 0.4)', glow: 'rgba(168, 85, 247, 0.15)', badgeBg: 'rgba(168, 85, 247, 0.15)', badgeColor: '#c084fc' },
    3: { border: 'rgba(99, 102, 241, 0.4)', glow: 'rgba(99, 102, 241, 0.15)', badgeBg: 'rgba(99, 102, 241, 0.15)', badgeColor: '#818cf8' },
    4: { border: 'rgba(16, 185, 129, 0.4)', glow: 'rgba(16, 185, 129, 0.15)', badgeBg: 'rgba(16, 185, 129, 0.15)', badgeColor: '#34d399' }
  };

  const steps = pipelineData?.pipeline_steps || [];

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 900,
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 25px 60px -15px rgba(0,0,0,0.9), 0 0 35px rgba(99, 102, 241, 0.25)'
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(6, 182, 212, 0.25))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                boxShadow: '0 0 15px rgba(99, 102, 241, 0.3)'
              }}
            >
              <Cpu size={22} color="#06b6d4" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Indexing Pipeline Visualizer</h3>
                <span className="version-badge">v{document.version || 1}</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginTop: 2 }}>
                Full multi-stage telemetry showing how <strong style={{ color: '#fff' }}>"{document.title}"</strong> is indexed into vector space.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.6rem' }}>
            <X size={16} />
          </button>
        </div>

        {/* Global Pipeline Telemetry Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1.75rem',
            background: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
              <Clock size={14} color="#38bdf8" />
              <span>Total Latency: <strong style={{ color: '#fff' }}>{pipelineData?.total_duration_ms || 355}ms</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
              <Box size={14} color="#a855f7" />
              <span>Total Chunks: <strong style={{ color: '#fff' }}>{document.chunk_count}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
              <Sparkles size={14} color="#6366f1" />
              <span>Embedding Vector Space: <strong style={{ color: '#fff' }}>3,072 Dimensions</strong></span>
            </div>
          </div>
          <span className="status-badge indexed" style={{ fontSize: '0.72rem' }}>
            <CheckCircle2 size={12} style={{ display: 'inline', marginRight: 4 }} />
            Pipeline Completed
          </span>
        </div>

        {/* Modal Body: The 4 Interactive Pipeline Stages */}
        <div className="modal-body" style={{ maxHeight: '68vh', overflowY: 'auto', padding: '1.5rem 1.75rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <Cpu size={32} className="spin-icon" style={{ margin: '0 auto 1rem', color: 'var(--accent-primary)' }} />
              <p>Reconstructing 4-stage pipeline telemetry...</p>
            </div>
          ) : (
            <div className="pipeline-stepper">
              {steps.map((step, idx) => {
                const theme = stageThemes[step.step] || stageThemes[1];
                const isHovered = activeStage === step.step;

                return (
                  <React.Fragment key={step.step}>
                    <ThreeDTiltCard
                      maxTilt={4}
                      scale={1.01}
                      className={`pipeline-step-card stage-completed ${isHovered ? 'glow-active-3d' : ''}`}
                      style={{
                        borderColor: isHovered ? theme.border : 'rgba(255, 255, 255, 0.08)',
                        background: 'rgba(18, 26, 44, 0.85)'
                      }}
                      onMouseEnter={() => setActiveStage(step.step)}
                      onMouseLeave={() => setActiveStage(null)}
                    >
                      <div className="pipeline-step-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '8px',
                              background: theme.badgeBg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: `1px solid ${theme.border}`
                            }}
                          >
                            {stageIcons[step.step]}
                          </div>
                          <div>
                            <span style={{ fontSize: '0.7rem', color: theme.badgeColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Stage 0{step.step}
                            </span>
                            <h4 style={{ fontSize: '1rem', color: '#fff', margin: 0 }}>
                              {step.name}
                            </h4>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span
                            className="pipeline-step-badge"
                            style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                          >
                            <CheckCircle2 size={11} />
                            Completed ({step.duration_ms}ms)
                          </span>
                        </div>
                      </div>

                      <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: '0.35rem 0 0.85rem' }}>
                        {step.description}
                      </p>

                      {/* Metrics Badges */}
                      <div className="pipeline-metrics-grid">
                        {Object.entries(step.metrics || {}).map(([key, val]) => (
                          <div key={key} className="pipeline-metric-item">
                            <div className="pipeline-metric-label">
                              {key.replace(/_/g, ' ')}
                            </div>
                            <div className="pipeline-metric-value">
                              {typeof val === 'boolean' ? (val ? 'TRUE' : 'FALSE') : val}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ThreeDTiltCard>

                    {/* Animated 3D Flow Connector between stages */}
                    {idx < steps.length - 1 && (
                      <div className="pipeline-flow-connector">
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'rgba(15, 23, 42, 0.9)',
                            border: '1px solid rgba(99, 102, 241, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)',
                            zIndex: 2
                          }}
                        >
                          <ArrowDown size={13} color="#38bdf8" />
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginRight: 'auto' }}>
            Pipeline Architecture: Google Gemini Embeddings (3,072d) + SQLite / pgvector Cosine Space
          </span>
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Close Visualizer
          </button>
        </div>
      </div>
    </div>
  );
}
