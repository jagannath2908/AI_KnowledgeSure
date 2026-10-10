import React, { useState, useEffect, useRef } from 'react';
import { Network, ZoomIn, ZoomOut, RotateCcw, Info, Layers, ArrowRight, X, ExternalLink } from 'lucide-react';

export default function KnowledgeGraph({ graphData, onOpenPassage }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeHopFilter, setActiveHopFilter] = useState('all');
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);

  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
        <Network size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
        <p>No multi-hop knowledge graph available for this query.</p>
      </div>
    );
  }

  const { nodes = [], edges = [], hops_count = 1 } = graphData;

  // Filter edges based on hop filter
  const filteredEdges = edges.filter(e =>
    activeHopFilter === 'all' || String(e.hop_order) === String(activeHopFilter)
  );

  // Compute node positions automatically using layout layers
  // Layer 0: query
  // Layer 1: document / concept
  // Layer 2: action / sub-concepts
  // Layer 3: outcome
  const width = 760;
  const height = 440;

  const nodePositions = React.useMemo(() => {
    const pos = {};
    const layers = {
      query: [],
      document: [],
      concept: [],
      action: [],
      outcome: []
    };

    nodes.forEach(n => {
      const t = n.type || 'concept';
      if (layers[t]) layers[t].push(n);
      else layers.concept.push(n);
    });

    // Arrange nodes from left to right across horizontal stages
    const stages = [
      layers.query,
      [...layers.document, ...layers.concept],
      layers.action,
      layers.outcome
    ].filter(s => s.length > 0);

    const stageWidth = width / (stages.length + 1);

    stages.forEach((stageNodes, stageIdx) => {
      const x = stageWidth * (stageIdx + 1);
      const stageHeight = height / (stageNodes.length + 1);

      stageNodes.forEach((node, nodeIdx) => {
        const y = stageHeight * (nodeIdx + 1);
        pos[node.id] = { x, y };
      });
    });

    return pos;
  }, [nodes, width, height]);

  const getNodeColor = (type) => {
    switch (type) {
      case 'query':
        return '#8b5cf6'; // Violet
      case 'document':
        return '#6366f1'; // Indigo
      case 'concept':
        return '#06b6d4'; // Cyan
      case 'action':
        return '#10b981'; // Emerald
      case 'outcome':
        return '#f59e0b'; // Amber
      default:
        return '#38bdf8';
    }
  };

  const handleMouseDown = (e) => {
    if (e.target.tagName === 'svg' || e.target.tagName === 'rect') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      style={{
        background: '#0a0f1d',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        marginTop: '1rem',
        position: 'relative',
        overflow: 'hidden'
      }}
      id="multi-hop-knowledge-graph-container"
    >
      {/* Graph Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
            <Network size={18} color="var(--accent-cyan)" />
          </div>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Multi-Hop Knowledge Graph</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              {nodes.length} Nodes • {edges.length} Semantic Edges • {hops_count} Reasoning Hops
            </span>
          </div>
        </div>

        {/* Hop Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginRight: 4 }}>Filter:</span>
          {['all', '1', '2', '3'].map((hop) => (
            <button
              key={hop}
              onClick={() => setActiveHopFilter(hop)}
              className="btn btn-secondary btn-sm"
              style={{
                padding: '0.2rem 0.55rem',
                fontSize: '0.72rem',
                background: activeHopFilter === hop ? 'var(--accent-primary)' : 'var(--bg-surface)',
                color: activeHopFilter === hop ? '#fff' : 'var(--text-muted)',
                borderColor: activeHopFilter === hop ? 'var(--accent-primary)' : 'var(--border-subtle)'
              }}
            >
              {hop === 'all' ? 'All Hops' : `Hop ${hop}`}
            </button>
          ))}

          {/* Zoom controls */}
          <div style={{ display: 'flex', gap: '0.2rem', marginLeft: '0.5rem' }}>
            <button
              onClick={() => setScale(s => Math.min(1.8, s + 0.15))}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.25rem' }}
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <button
              onClick={() => setScale(s => Math.max(0.6, s - 0.15))}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.25rem' }}
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={resetView}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.25rem' }}
              title="Reset View"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: 380,
          background: 'radial-gradient(ellipse at center, rgba(17, 24, 39, 0.7) 0%, rgba(9, 13, 22, 0.95) 100%)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          cursor: isDragging ? 'grabbing' : 'grab',
          position: 'relative',
          overflow: 'hidden'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Arrowhead marker */}
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="14"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
            </marker>

            {/* Glowing filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {/* Edges */}
            {filteredEdges.map((edge, idx) => {
              const p1 = nodePositions[edge.source];
              const p2 = nodePositions[edge.target];
              if (!p1 || !p2) return null;

              // Quadratic curve
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2 - 15;
              const pathD = `M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`;

              const hopColor = edge.hop_order === 1 ? '#8b5cf6' : edge.hop_order === 2 ? '#06b6d4' : '#10b981';

              return (
                <g key={`edge-${idx}`}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={hopColor}
                    strokeWidth="1.8"
                    strokeDasharray={edge.hop_order === 3 ? "4 3" : "none"}
                    opacity="0.65"
                    markerEnd="url(#arrowhead)"
                  />
                  {/* Relation Label Pill */}
                  <rect
                    x={midX - 35}
                    y={midY - 9}
                    width="70"
                    height="16"
                    rx="4"
                    fill="#0f172a"
                    stroke="rgba(255,255,255,0.1)"
                  />
                  <text
                    x={midX}
                    y={midY + 3}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="8"
                    fontFamily="var(--font-mono)"
                  >
                    Hop {edge.hop_order}: {edge.relation.slice(0, 11)}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;

              const isSelected = selectedNode?.id === node.id;
              const color = getNodeColor(node.type);

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={() => setSelectedNode(node)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Pulse ring for query or selected */}
                  {(node.type === 'query' || isSelected) && (
                    <circle
                      r="22"
                      fill="none"
                      stroke={color}
                      strokeWidth="1.5"
                      opacity="0.4"
                      className="spin-icon"
                    />
                  )}

                  {/* Main Node Circle */}
                  <circle
                    r="15"
                    fill="#1e293b"
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 2}
                    filter="url(#glow)"
                  />

                  {/* Inner center dot */}
                  <circle
                    r="4"
                    fill={color}
                  />

                  {/* Node Title Label */}
                  <text
                    y="27"
                    textAnchor="middle"
                    fill={isSelected ? '#fff' : '#e2e8f0'}
                    fontSize="10"
                    fontWeight={isSelected ? 700 : 500}
                    fontFamily="var(--font-body)"
                  >
                    {node.label.length > 20 ? `${node.label.slice(0, 18)}...` : node.label}
                  </text>

                  {/* Node Type Badge */}
                  <text
                    y="37"
                    textAnchor="middle"
                    fill="var(--text-dim)"
                    fontSize="7"
                    textTransform="uppercase"
                  >
                    {node.type}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 12,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '0.4rem 0.8rem',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            gap: '0.8rem',
            fontSize: '0.72rem'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }}></span>
            Query
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4' }}></span>
            Concept
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
            Action
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }}></span>
            Outcome
          </span>
        </div>
      </div>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div
          style={{
            marginTop: '0.75rem',
            background: '#141e33',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{
                background: `${getNodeColor(selectedNode.type)}25`,
                color: getNodeColor(selectedNode.type),
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '0.15rem 0.45rem',
                borderRadius: 'var(--radius-sm)'
              }}>
                {selectedNode.type}
              </span>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                {selectedNode.label}
              </h5>
              {selectedNode.chunk_index && (
                <span className="citation-tag">
                  Chunk #{selectedNode.chunk_index}
                </span>
              )}
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              {selectedNode.description || 'Discovered entity in the multi-hop reasoning path.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {selectedNode.chunk_index && onOpenPassage && (
              <button
                onClick={() => onOpenPassage(selectedNode.chunk_index)}
                className="btn btn-primary btn-sm"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                title="View document chunk"
              >
                <ExternalLink size={12} />
                <span>Inspect Chunk</span>
              </button>
            )}
            <button
              onClick={() => setSelectedNode(null)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.25rem' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
