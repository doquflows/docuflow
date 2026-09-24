import { listWiki } from "./list-wiki";

export interface GraphNode {
  id: string;
  title: string;
  category: string;
  degree: number;
  in_degree: number;
  out_degree: number;
  stale: boolean;
  updated_at: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: "outbound" | "inbound" | "both";
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    total_pages: number;
    total_edges: number;
    orphans: number;
    isolated: number;
    dangling_refs: string[];
    generated_at: string;
  };
  error?: string;
}

const SEP = "\u0000";

export async function buildGraph(input: { project_path: string }): Promise<GraphResponse> {
  const generatedAt = new Date().toISOString();
  try {
    const wiki = await listWiki({ project_path: input.project_path });
    if (wiki.error) {
      return {
        nodes: [],
        edges: [],
        meta: {
          total_pages: 0, total_edges: 0, orphans: 0, isolated: 0,
          dangling_refs: [], generated_at: generatedAt,
        },
        error: wiki.error,
      };
    }

    const pages = wiki.pages;
    const nodeIds = new Set<string>(pages.map((p) => p.id));

    const edgeMap = new Map<string, GraphEdge>();
    const dangling = new Set<string>();

    // Pass 1: outbound
    for (const page of pages) {
      const src = page.id;
      for (const tgt of page.outbound_links ?? []) {
        if (tgt === src) continue;
        if (!nodeIds.has(tgt)) { dangling.add(tgt); continue; }
        const key = `${src}${SEP}${tgt}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { source: src, target: tgt, kind: "outbound" });
        }
      }
    }

    // Pass 2: inbound — `n.inbound_links` lists pages that point AT n.
    for (const page of pages) {
      const tgt = page.id;
      for (const src of page.inbound_links ?? []) {
        if (src === tgt) continue;
        if (!nodeIds.has(src)) { dangling.add(src); continue; }
        const key = `${src}${SEP}${tgt}`;
        const existing = edgeMap.get(key);
        if (existing) {
          if (existing.kind === "outbound") existing.kind = "both";
          // already 'inbound' or 'both' → keep
        } else {
          edgeMap.set(key, { source: src, target: tgt, kind: "inbound" });
        }
      }
    }

    const edges = Array.from(edgeMap.values());

    // Compute resolved in/out degree from final edge list.
    const inDeg = new Map<string, number>();
    const outDeg = new Map<string, number>();
    for (const e of edges) {
      outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + 1);
      inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
    }

    const nodes: GraphNode[] = pages.map((p) => {
      const out_degree = outDeg.get(p.id) ?? 0;
      const in_degree = inDeg.get(p.id) ?? 0;
      return {
        id: p.id,
        title: p.title,
        category: p.category,
        degree: in_degree + out_degree,
        in_degree,
        out_degree,
        stale: p.stale,
        updated_at: p.updated_at,
      };
    });

    const orphans = nodes.filter((n) => n.in_degree === 0).length;
    const isolated = nodes.filter((n) => n.degree === 0).length;

    return {
      nodes,
      edges,
      meta: {
        total_pages: nodes.length,
        total_edges: edges.length,
        orphans,
        isolated,
        dangling_refs: Array.from(dangling).sort(),
        generated_at: generatedAt,
      },
    };
  } catch (e: any) {
    return {
      nodes: [],
      edges: [],
      meta: {
        total_pages: 0, total_edges: 0, orphans: 0, isolated: 0,
        dangling_refs: [], generated_at: generatedAt,
      },
      error: e?.message ?? String(e),
    };
  }
}
