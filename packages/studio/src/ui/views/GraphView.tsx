import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Pill, Btn } from '../components/UIKit';
import type { NodeKind, GraphApiResponse, GraphApiNode, GraphApiEdge } from '../types';
import { useProject } from '../context/ProjectContext';
import { useApi } from '../hooks/useApi';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { drag } from 'd3-drag';

const COLORS: Record<NodeKind, string> = {
  module:    '#a5b4fc',
  api:       '#34d399',
  concept:   '#fbbf24',
  entity:    '#f472b6',
  timeline:  '#60a5fa',
  synthesis: '#c4b5fd',
  source:    '#94a3b8',
};

function colorFor(k: string): string {
  return (COLORS as Record<string, string>)[k] ?? COLORS.module;
}

const ALL_KINDS: NodeKind[] = ['entity', 'concept', 'timeline', 'synthesis', 'source'];

// FNV-1a hash → 32-bit unsigned int
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// Halton sequence generator for deterministic, well-spread initial layout
function halton(index: number, base: number): number {
  let f = 1;
  let r = 0;
  let i = index;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  data: GraphApiNode;
}

type SimLink = SimulationLinkDatum<SimNode> & { kind: GraphApiEdge['kind'] };

export default function GraphView(): JSX.Element {
  const { projectPath, apiOnline } = useProject();

  const { data, loading, error } = useApi<GraphApiResponse | null>(
    apiOnline && projectPath ? `/api/graph?path=${encodeURIComponent(projectPath)}` : null,
    null,
  );

  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hideIsolated, setHideIsolated] = useState(false);
  const [hideOrphans, setHideOrphans] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<Set<NodeKind>>(new Set(ALL_KINDS));

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodesArrRef = useRef<SimNode[]>([]);
  const linksArrRef = useRef<SimLink[]>([]);
  const tickRafRef = useRef<number | null>(null);

  const [size, setSize] = useState({ w: 800, h: 600 });
  const [tickVersion, setTickVersion] = useState(0);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(100, r.width), h: Math.max(100, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Apply visibility filters BEFORE building simulation arrays
  const visibleNodes = useMemo<GraphApiNode[]>(() => {
    if (!data) return [];
    return data.nodes.filter((n) => {
      if (!categoryFilter.has(n.category as NodeKind)) return false;
      if (hideIsolated && n.degree === 0) return false;
      if (hideOrphans && n.in_degree === 0) return false;
      return true;
    });
  }, [data, categoryFilter, hideIsolated, hideOrphans]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo<GraphApiEdge[]>(() => {
    if (!data) return [];
    return data.edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [data, visibleNodeIds]);

  // Search-match set (for dimming, not for hiding)
  const searchMatches = useMemo<Set<string> | null>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const m = new Set<string>();
    for (const n of visibleNodes) {
      if (n.id.toLowerCase().startsWith(q) || n.title.toLowerCase().startsWith(q)) {
        m.add(n.id);
      }
    }
    return m;
  }, [query, visibleNodes]);

  // Build / rebuild force simulation when visible graph topology changes
  useEffect(() => {
    if (visibleNodes.length === 0) {
      simRef.current?.stop();
      simRef.current = null;
      nodesArrRef.current = [];
      linksArrRef.current = [];
      setTickVersion((v) => v + 1);
      return;
    }

    // Deterministic seed from sorted node IDs
    const sortedIds = [...visibleNodes.map((n) => n.id)].sort();
    const seed = fnv1a(sortedIds.join('|'));
    const offset = seed % 997;

    const w = size.w;
    const h = size.h;

    const simNodes: SimNode[] = visibleNodes.map((n, i) => {
      const hx = halton(i + offset + 1, 2);
      const hy = halton(i + offset + 1, 3);
      return {
        id: n.id,
        data: n,
        x: hx * w,
        y: hy * h,
      };
    });

    const idIndex = new Map(simNodes.map((n) => [n.id, n] as const));
    const simLinks: SimLink[] = visibleEdges
      .filter((e) => idIndex.has(e.source) && idIndex.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, kind: e.kind }));

    nodesArrRef.current = simNodes;
    linksArrRef.current = simLinks;

    const sim = forceSimulation<SimNode, SimLink>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(60)
          .strength(0.5),
      )
      .force('charge', forceManyBody().strength(-120))
      .force('center', forceCenter(w / 2, h / 2))
      .force('collide', forceCollide(14))
      .alphaMin(0.01)
      .stop();

    simRef.current = sim;

    // Run up to 600 ticks synchronously (cheap for <2k nodes), then notify React.
    const MAX_TICKS = 600;
    let ticks = 0;
    const runChunk = () => {
      const start = performance.now();
      while (ticks < MAX_TICKS && sim.alpha() > sim.alphaMin()) {
        sim.tick();
        ticks++;
        if (performance.now() - start > 16) break;
      }
      setTickVersion((v) => v + 1);
      if (ticks < MAX_TICKS && sim.alpha() > sim.alphaMin()) {
        tickRafRef.current = requestAnimationFrame(runChunk);
      } else {
        tickRafRef.current = null;
      }
    };
    runChunk();

    return () => {
      if (tickRafRef.current != null) cancelAnimationFrame(tickRafRef.current);
      tickRafRef.current = null;
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes.length, visibleEdges.length, projectPath, size.w, size.h]);

  // d3-zoom + d3-drag wiring
  useEffect(() => {
    const svgEl = svgRef.current;
    const gEl = gRef.current;
    if (!svgEl || !gEl) return;

    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4])
      .on('zoom', (event) => {
        select(gEl).attr('transform', event.transform.toString());
      });
    zoomRef.current = z;
    select(svgEl).call(z);

    return () => {
      select(svgEl).on('.zoom', null);
    };
  }, []);

  // Bind drag to node circles whenever visible nodes/edges change.
  // React renders the <g> elements so they have no D3 datum bound; calling
  // .data(nodes, keyFn) would invoke keyFn on those un-datumed elements
  // (d === undefined) and crash. Instead, look up each SimNode via the
  // data-nid attribute set on each <g> in JSX.
  useEffect(() => {
    const gEl = gRef.current;
    if (!gEl) return;

    const nodeMap = new Map(nodesArrRef.current.map((n) => [n.id, n]));

    const dragBehavior = drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simRef.current?.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simRef.current?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    select(gEl)
      .selectAll<SVGGElement, unknown>('g.df-graph__node')
      .each(function () {
        const id = (this as SVGGElement).dataset.nid;
        const node = id ? nodeMap.get(id) : undefined;
        if (node) select<SVGGElement, SimNode>(this as SVGGElement).datum(node).call(dragBehavior);
      });
  }, [visibleNodes.length, visibleEdges.length]);

  // Adjacency for the focused node
  const focusedId = hovered ?? selected;
  const adj = useMemo(() => {
    const s = new Set<string>();
    if (!focusedId) return s;
    s.add(focusedId);
    for (const e of visibleEdges) {
      if (e.source === focusedId) s.add(e.target);
      if (e.target === focusedId) s.add(e.source);
    }
    return s;
  }, [focusedId, visibleEdges]);

  const selectedNode = useMemo(() => {
    if (!selected || !data) return null;
    return data.nodes.find((n) => n.id === selected) ?? null;
  }, [selected, data]);

  const selectedOutbound = useMemo(() => {
    if (!selected || !data) return [];
    const ids = data.edges.filter((e) => e.source === selected).map((e) => e.target);
    return ids.map((id) => data.nodes.find((n) => n.id === id)).filter(Boolean) as GraphApiNode[];
  }, [selected, data]);

  const selectedInbound = useMemo(() => {
    if (!selected || !data) return [];
    const ids = data.edges.filter((e) => e.target === selected).map((e) => e.source);
    return ids.map((id) => data.nodes.find((n) => n.id === id)).filter(Boolean) as GraphApiNode[];
  }, [selected, data]);

  const fitView = useCallback(() => {
    const svgEl = svgRef.current;
    if (!svgEl || !zoomRef.current) return;
    select(svgEl).call(zoomRef.current.transform, zoomIdentity);
  }, []);

  const restartSim = useCallback(() => {
    simRef.current?.alpha(1).restart();
    if (tickRafRef.current == null) {
      const tick = () => {
        const sim = simRef.current;
        if (!sim) return;
        const start = performance.now();
        while (sim.alpha() > sim.alphaMin()) {
          sim.tick();
          if (performance.now() - start > 16) break;
        }
        setTickVersion((v) => v + 1);
        if (sim.alpha() > sim.alphaMin()) {
          tickRafRef.current = requestAnimationFrame(tick);
        } else {
          tickRafRef.current = null;
        }
      };
      tickRafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const toggleCategory = (k: NodeKind) => {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const openSelectedPage = () => {
    if (!selected) return;
    window.location.hash = `#wiki/${selected}`;
    window.dispatchEvent(new CustomEvent('docuflow:openPage', { detail: { id: selected } }));
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const isEmpty = !loading && !error && (!data || data.nodes.length === 0 || visibleNodes.length === 0);
  const danglingCount = data?.meta.dangling_refs.length ?? 0;

  return (
    <div className="df-graph">
      <div className="df-graph__canvas" ref={containerRef}>
        <div className="df-graph__grid" />

        <div className="df-graph__legend">
          {ALL_KINDS.map((k) => (
            <div key={k} className="df-graph__legend-row">
              <span className="df-graph__legend-swatch" style={{ background: colorFor(k) }} />
              <span>{k}</span>
            </div>
          ))}
        </div>

        <div
          className="df-graph__controls"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            alignItems: 'flex-end',
            maxWidth: 360,
          }}
        >
          <input
            type="text"
            placeholder="Search nodes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              background: 'var(--df-surface-2)',
              color: 'var(--df-text-1)',
              border: '1px solid var(--df-border)',
              borderRadius: 6,
              width: 220,
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <label style={{ fontSize: 11, color: 'var(--df-text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={hideIsolated} onChange={(e) => setHideIsolated(e.target.checked)} />
              Hide isolated
            </label>
            <label style={{ fontSize: 11, color: 'var(--df-text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={hideOrphans} onChange={(e) => setHideOrphans(e.target.checked)} />
              Hide orphans
            </label>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {ALL_KINDS.map((k) => (
              <button
                key={k}
                onClick={() => toggleCategory(k)}
                style={{
                  fontSize: 10,
                  padding: '3px 8px',
                  borderRadius: 12,
                  border: `1px solid ${colorFor(k)}`,
                  background: categoryFilter.has(k) ? colorFor(k) : 'transparent',
                  color: categoryFilter.has(k) ? '#0a0a0c' : colorFor(k),
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {k}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn onClick={fitView}>Fit</Btn>
            <Btn onClick={restartSim}>Restart</Btn>
          </div>
        </div>

        {isEmpty && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <div
              style={{
                background: 'var(--df-surface-1)',
                border: '1px solid var(--df-border)',
                borderRadius: 8,
                padding: '20px 28px',
                textAlign: 'center',
                color: 'var(--df-text-3)',
                fontSize: 13,
              }}
            >
              {error ? (
                <>
                  <div style={{ marginBottom: 6, color: 'var(--df-danger, #f87171)' }}>Failed to load graph</div>
                  <div style={{ fontSize: 11 }}>{error}</div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 6, color: 'var(--df-text-2)' }}>No links found in frontmatter</div>
                  <div style={{ fontSize: 11 }}>
                    Run <code>docuflow sync</code> to ingest sources, then refresh.
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <svg ref={svgRef} className="df-graph__svg" width={size.w} height={size.h} data-tick={tickVersion}>
          <g ref={gRef}>
            {linksArrRef.current.map((l, i) => {
              const s = (l.source as SimNode).id ?? (l.source as unknown as string);
              const t = (l.target as SimNode).id ?? (l.target as unknown as string);
              const sx = (l.source as SimNode).x ?? 0;
              const sy = (l.source as SimNode).y ?? 0;
              const tx = (l.target as SimNode).x ?? 0;
              const ty = (l.target as SimNode).y ?? 0;
              const dim = focusedId !== null && !(adj.has(s) && adj.has(t));
              const isBoth = l.kind === 'both';
              return (
                <line
                  key={`${s}->${t}-${i}`}
                  x1={sx}
                  y1={sy}
                  x2={tx}
                  y2={ty}
                  stroke={isBoth ? '#52525b' : '#3f3f46'}
                  strokeWidth={
                    focusedId && (adj.has(s) && adj.has(t)) ? 2 : isBoth ? 1.5 : 1
                  }
                  opacity={dim ? 0.15 : isBoth ? 0.7 : 0.5}
                />
              );
            })}
            {nodesArrRef.current.map((n) => {
              const d = n.data;
              const r = 4 + Math.min(8, d.degree * 0.6);
              const isSel = selected === n.id;
              const dim = focusedId !== null && !adj.has(n.id);
              const searchDim = searchMatches !== null && !searchMatches.has(n.id);
              const isolated = d.degree === 0;
              const fill = isolated ? 'transparent' : colorFor(d.category);
              const opacity = dim ? 0.2 : searchDim ? 0.3 : 1;
              return (
                <g
                  key={n.id}
                  className="df-graph__node"
                  data-nid={n.id}
                  transform={`translate(${n.x ?? 0}, ${n.y ?? 0})`}
                  style={{ cursor: 'pointer', opacity, transition: 'opacity .15s' }}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(n.id)}
                >
                  <title>{`${d.title} (${d.category}) · in:${d.in_degree} out:${d.out_degree}`}</title>
                  <circle
                    r={r}
                    fill={fill}
                    stroke={colorFor(d.category)}
                    strokeWidth={isSel ? 2.5 : 1.5}
                    strokeDasharray={d.stale ? '2,2' : undefined}
                  />
                  {(isSel || focusedId === n.id || d.degree >= 5) && (
                    <text
                      y={r + 11}
                      textAnchor="middle"
                      fontSize="10"
                      fill={isSel ? '#ededee' : '#a1a1aa'}
                      fontFamily="var(--df-font-sans)"
                      style={{ pointerEvents: 'none' }}
                    >
                      {d.title.length > 24 ? d.title.slice(0, 22) + '…' : d.title}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {danglingCount > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 16,
              bottom: 16,
              fontSize: 11,
              color: 'var(--df-text-3)',
              background: 'var(--df-surface-2)',
              border: '1px solid var(--df-border)',
              borderRadius: 12,
              padding: '4px 10px',
              zIndex: 2,
            }}
          >
            {danglingCount} dangling reference{danglingCount === 1 ? '' : 's'} — run{' '}
            <code>docuflow lint</code>
          </div>
        )}
      </div>

      <aside className="df-graph__detail">
        <div className="df-eyebrow" style={{ marginBottom: 12 }}>
          {selectedNode ? 'Selected node' : 'Graph'}
        </div>

        {selectedNode ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: colorFor(selectedNode.category),
                }}
              />
              <span style={{ fontSize: 18, fontWeight: 600 }}>{selectedNode.title}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <Pill tone="accent">{selectedNode.category}</Pill>
              <Pill>{selectedNode.in_degree} in</Pill>
              <Pill>{selectedNode.out_degree} out</Pill>
              {selectedNode.stale && <Pill tone="amber">stale</Pill>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--df-text-4)', marginBottom: 18 }}>
              Updated {new Date(selectedNode.updated_at).toLocaleString()}
            </div>

            <div className="df-eyebrow" style={{ marginBottom: 8 }}>
              Outbound ({selectedOutbound.length})
            </div>
            <div style={{ marginBottom: 18, maxHeight: 200, overflowY: 'auto' }}>
              {selectedOutbound.map((n) => (
                <div
                  key={n.id}
                  className="df-graph__connection"
                  onClick={() => setSelected(n.id)}
                >
                  <span
                    className="df-graph__connection-dot"
                    style={{ background: colorFor(n.category) }}
                  />
                  <span>{n.title}</span>
                </div>
              ))}
              {selectedOutbound.length === 0 && (
                <span style={{ color: 'var(--df-text-4)', fontSize: 12 }}>None</span>
              )}
            </div>

            <div className="df-eyebrow" style={{ marginBottom: 8 }}>
              Inbound ({selectedInbound.length})
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {selectedInbound.map((n) => (
                <div
                  key={n.id}
                  className="df-graph__connection"
                  onClick={() => setSelected(n.id)}
                >
                  <span
                    className="df-graph__connection-dot"
                    style={{ background: colorFor(n.category) }}
                  />
                  <span>{n.title}</span>
                </div>
              ))}
              {selectedInbound.length === 0 && (
                <span style={{ color: 'var(--df-text-4)', fontSize: 12 }}>None</span>
              )}
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 6 }}>
              <Btn icon="book" variant="primary" onClick={openSelectedPage}>
                Open page
              </Btn>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--df-text-3)', lineHeight: 1.6 }}>
            {data ? (
              <>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: 'var(--df-text-1)' }}>{data.meta.total_pages}</strong> pages,{' '}
                  <strong style={{ color: 'var(--df-text-1)' }}>{data.meta.total_edges}</strong> edges
                </div>
                <div>
                  {data.meta.orphans} orphans · {data.meta.isolated} isolated
                </div>
                <div style={{ marginTop: 16, color: 'var(--df-text-4)' }}>
                  Click a node to inspect its connections.
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--df-text-4)' }}>
                {loading
                  ? 'Loading graph…'
                  : !apiOnline
                    ? 'API offline.'
                    : !projectPath
                      ? 'No project selected.'
                      : error
                        ? `Failed to load graph: ${error}`
                        : 'No wiki pages yet.'}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
