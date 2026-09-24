import path from "node:path";
import { listModules } from "./list-modules";

interface GraphNode {
  id: string;
  label: string;
  language: string;
  classes: number;
  functions: number;
  db_tables: string[];
  endpoints: string[];
}

interface GraphEdge {
  from: string;
  to: string;
  type: "imports" | "shared_table" | "shared_endpoint";
}

interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  shared_tables: Record<string, string[]>;
  shared_endpoints: Record<string, string[]>;
  most_connected: Array<{ id: string; label: string; connection_count: number }>;
  summary: string;
}

export async function generateDependencyGraph(input: {
  project_path: string;
  extensions?: string[];
  focus?: string;
}): Promise<DependencyGraph | { error: string }> {
  try {
    const projectPath = path.resolve(input.project_path);

    // Scan all modules
    const listResult = await listModules({
      path: projectPath,
      extensions: input.extensions,
    });

    const modules = listResult.modules ?? [];
    if (modules.length === 0) {
      return {
        nodes: [],
        edges: [],
        shared_tables: {},
        shared_endpoints: {},
        most_connected: [],
        summary: "No source files found in the project.",
      };
    }

    // Build id from relative path (normalised for use as node id)
    const relPath = (filePath: string) =>
      path.relative(projectPath, filePath).replace(/\\/g, "/");

    // Build nodes map
    const nodeMap = new Map<string, GraphNode>();
    for (const mod of modules) {
      const id = relPath(mod.path);
      nodeMap.set(id, {
        id,
        label: path.basename(mod.path),
        language: mod.language,
        classes: mod.classes.length,
        functions: mod.functions.length,
        db_tables: mod.db_tables,
        endpoints: mod.endpoints,
      });
    }

    // Build import edges: for each module's dependency list, look for matches in node IDs
    const edges: GraphEdge[] = [];
    const edgeSet = new Set<string>(); // avoid duplicates

    for (const mod of modules) {
      const fromId = relPath(mod.path);
      for (const dep of mod.dependencies) {
        // Try to resolve dep to a known node (relative path match or basename match)
        for (const [nodeId] of nodeMap) {
          // Match if the dependency string is contained in the node path
          // (e.g., dep = "./user-service" matches "src/user-service.ts")
          const depNorm = dep.replace(/^[./]+/, "").replace(/\\/g, "/").toLowerCase();
          const nodeNorm = nodeId.replace(/\\/g, "/").toLowerCase();
          if (
            depNorm.length > 2 &&
            (nodeNorm.includes(depNorm) || nodeNorm.replace(/\.\w+$/, "").endsWith(depNorm))
          ) {
            const key = `${fromId}->${nodeId}`;
            if (fromId !== nodeId && !edgeSet.has(key)) {
              edgeSet.add(key);
              edges.push({ from: fromId, to: nodeId, type: "imports" });
            }
          }
        }
      }
    }

    // Shared DB tables
    const tableToModules = new Map<string, string[]>();
    for (const mod of modules) {
      for (const table of mod.db_tables) {
        const key = table.toLowerCase();
        if (!tableToModules.has(key)) tableToModules.set(key, []);
        tableToModules.get(key)!.push(relPath(mod.path));
      }
    }
    const shared_tables: Record<string, string[]> = {};
    for (const [table, mods] of tableToModules) {
      if (mods.length > 1) {
        shared_tables[table] = mods;
        // Add shared_table edges
        for (let i = 0; i < mods.length; i++) {
          for (let j = i + 1; j < mods.length; j++) {
            const key = `${mods[i]}<>${mods[j]}:${table}`;
            if (!edgeSet.has(key)) {
              edgeSet.add(key);
              edges.push({ from: mods[i], to: mods[j], type: "shared_table" });
            }
          }
        }
      }
    }

    // Shared endpoints
    const endpointToModules = new Map<string, string[]>();
    for (const mod of modules) {
      for (const ep of mod.endpoints) {
        if (!endpointToModules.has(ep)) endpointToModules.set(ep, []);
        endpointToModules.get(ep)!.push(relPath(mod.path));
      }
    }
    const shared_endpoints: Record<string, string[]> = {};
    for (const [ep, mods] of endpointToModules) {
      if (mods.length > 1) shared_endpoints[ep] = mods;
    }

    // Most connected nodes (by total edge count)
    const connectionCount = new Map<string, number>();
    for (const edge of edges) {
      connectionCount.set(edge.from, (connectionCount.get(edge.from) ?? 0) + 1);
      connectionCount.set(edge.to, (connectionCount.get(edge.to) ?? 0) + 1);
    }
    const most_connected = Array.from(connectionCount.entries())
      .map(([id, count]) => ({
        id,
        label: nodeMap.get(id)?.label ?? id,
        connection_count: count,
      }))
      .sort((a, b) => b.connection_count - a.connection_count)
      .slice(0, 10);

    // Apply focus filter: if focus is set, only include nodes/edges reachable from it
    let nodes = Array.from(nodeMap.values());
    let filteredEdges = edges;
    if (input.focus) {
      const focusNorm = input.focus.toLowerCase();
      const focusId = nodes.find((n) => n.id.toLowerCase().includes(focusNorm))?.id;
      if (focusId) {
        const reachable = new Set<string>([focusId]);
        // BFS: include direct neighbours
        for (const e of edges) {
          if (e.from === focusId) reachable.add(e.to);
          if (e.to === focusId) reachable.add(e.from);
        }
        nodes = nodes.filter((n) => reachable.has(n.id));
        filteredEdges = edges.filter((e) => reachable.has(e.from) && reachable.has(e.to));
      }
    }

    const sharedTableCount = Object.keys(shared_tables).length;
    const summary = [
      `${nodes.length} modules, ${filteredEdges.length} dependencies`,
      sharedTableCount > 0 ? `${sharedTableCount} shared DB table(s)` : null,
      most_connected.length > 0
        ? `Most connected: ${most_connected[0].label} (${most_connected[0].connection_count} links)`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      nodes,
      edges: filteredEdges,
      shared_tables,
      shared_endpoints,
      most_connected,
      summary,
    };
  } catch (e: any) {
    return { error: e?.message ?? String(e) };
  }
}
