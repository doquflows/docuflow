import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

/**
 * Context-as-a-Service MCP tool.
 * Builds and queries a persistent SQLite index of a directory using FTS5 and sqlite-vec (for semantic search).
 */
export async function getContext(args: { 
  operation?: "index" | "query"; 
  directory: string; 
  query?: string;
  mode?: "semantic" | "lexical" | "hybrid";
}) {
  const operation = args.operation || "query";
  const dbPath = path.join(args.directory, ".context.db");
  const mode = args.mode || "lexical"; // Default to backward-compatible lexical search

  if (operation === "index") {
    let db: any;
    try {
      db = new Database(dbPath);
      sqliteVec.load(db);
      
      // Initialize FTS5 table
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(path, content);
      `);
      
      // Initialize Vector tables
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_docs USING vec0(embedding float[384]);
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS doc_vec_map (
          doc_rowid INTEGER,
          vec_rowid INTEGER
        );
      `);

      // Clear existing entries for this directory
      db.exec(`DELETE FROM docs; DELETE FROM vec_docs; DELETE FROM doc_vec_map;`);

      const filesToIndex: {path: string, content: string}[] = [];

      function scan(dir: string) {
        if (!fs.existsSync(dir)) return;
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          if (item === "node_modules" || item === ".git" || item === "dist" || item === "build" || item === ".docuflow" || item === ".context.db" || item === ".context.db-journal") continue;
          const fullPath = path.join(dir, item);
          
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              scan(fullPath);
            } else {
              // Basic check to skip large/binary files
              if (stat.size > 300 * 1024) continue;
              const content = fs.readFileSync(fullPath, "utf-8");
              // Check if it looks like text (not perfect, but simple)
              if (content.indexOf("\0") === -1) {
                 filesToIndex.push({ path: fullPath, content });
              }
            }
          } catch (e) {
            // Skip unreadable files
          }
        }
      }

      scan(args.directory);

      let extractor: any;
      try {
        const transformers = await import("@xenova/transformers");
        extractor = await transformers.pipeline("feature-extraction", "Xenova/multilingual-e5-small");
      } catch (e) {
        console.warn("Failed to load @xenova/transformers for embeddings. Semantic search won't be available.");
      }

      const insertFts = db.prepare(`INSERT INTO docs (path, content) VALUES (?, ?)`);
      const insertVec = db.prepare(`INSERT INTO vec_docs (embedding) VALUES (?)`);
      const insertMap = db.prepare(`INSERT INTO doc_vec_map (doc_rowid, vec_rowid) VALUES (?, ?)`);

      db.exec("BEGIN TRANSACTION");
      try {
        for (const file of filesToIndex) {
          const info = insertFts.run(file.path, file.content);
          const docRowId = info.lastInsertRowid;

          if (extractor) {
            try {
              // Embed up to 1000 chars to avoid token limits on large files
              const textToEmbed = "passage: " + file.content.slice(0, 1000);
              const output = await extractor(textToEmbed, { pooling: "mean", normalize: true });
              const embeddingArray = new Float32Array(output.data);
              
              const vecInfo = insertVec.run(embeddingArray);
              const vecRowId = vecInfo.lastInsertRowid;
              
              insertMap.run(docRowId, vecRowId);
            } catch (err) {
              console.warn("Failed to embed document: " + file.path, err);
            }
          }
        }
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }

      return {
        message: `Indexed ${filesToIndex.length} files in '${args.directory}'`,
        status: "success"
      };
    } catch (e: any) {
      return { error: `Indexing failed: ${e.message}`, status: "error" };
    } finally {
      if (db) db.close();
    }
  } else {
    // operation === "query"
    if (!args.query) {
      return { error: "Query string is required for 'query' operation", status: "error" };
    }

    if (!fs.existsSync(dbPath)) {
      return { error: `Index not found at '${dbPath}'. Please run the 'index' operation first.`, status: "error" };
    }

    let db: any;
    try {
      db = new Database(dbPath, { readonly: true });
      sqliteVec.load(db);
      
      let results: any[] = [];

      if (mode === "lexical" || mode === "hybrid") {
        const stmt = db.prepare(`
          SELECT path, snippet(docs, 1, '<b>', '</b>', '...', 64) as snippet 
          FROM docs 
          WHERE docs MATCH ? 
          ORDER BY rank 
          LIMIT 20
        `);
        const ftsQuery = args.query.includes(" ") ? `"${args.query}"` : args.query;
        results = stmt.all(ftsQuery);
      }

      if (mode === "semantic" || mode === "hybrid") {
        const hasVec = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='vec_docs'").get();
        if (!hasVec) {
          if (mode === "semantic") {
            return { error: "No vector index found. Re-run the 'index' operation to enable semantic search.", status: "error" };
          }
          return {
            message: `Found ${results.length} files matching '${args.query}' in '${args.directory}'`,
            matches: results,
            warning: "No vector index found; returning lexical results only. Re-run 'index' to enable semantic search.",
            status: "success",
          };
        }

        let extractor: any;
        try {
          const transformers = await import("@xenova/transformers");
          extractor = await transformers.pipeline("feature-extraction", "Xenova/multilingual-e5-small");
        } catch(e: any) {
          if (mode === "hybrid") {
            return {
              message: `Found ${results.length} files matching '${args.query}' in '${args.directory}'`,
              matches: results,
              warning: "Embeddings model not available; returning lexical results only.",
              status: "success",
            };
          }
          return { error: "Embeddings model not available: " + e.message, status: "error" };
        }

        const output = await extractor("query: " + args.query, { pooling: "mean", normalize: true });
        const queryEmbedding = new Float32Array(output.data);

        const stmt = db.prepare(`
          SELECT d.path, substr(d.content, 1, 200) as snippet, vec_distance_cosine(v.embedding, ?) as distance
          FROM vec_docs v
          JOIN doc_vec_map m ON v.rowid = m.vec_rowid
          JOIN docs d ON d.rowid = m.doc_rowid
          WHERE v.embedding MATCH ? AND k = 20
          ORDER BY distance
        `);
        const vecResults = stmt.all(queryEmbedding, queryEmbedding);

        if (mode === "semantic") {
          results = vecResults;
        } else if (mode === "hybrid") {
          const existingPaths = new Set(results.map(r => r.path));
          for (const vr of vecResults) {
            if (!existingPaths.has(vr.path)) {
              results.push(vr);
            }
          }
        }
      }

      return {
        message: `Found ${results.length} files matching '${args.query}' in '${args.directory}'`,
        matches: results,
        status: "success"
      };
    } catch (e: any) {
      return { error: `Query failed: ${e.message}`, status: "error" };
    } finally {
      if (db) db.close();
    }
  }
}
