// Library exports for @doquflow/studio and other consumers.
// Core tools (4 MCP-registered tools):
export { ingestSource } from "./tools/ingest-source";
export { queryWiki } from "./tools/query-wiki";
export { queryProject } from "./tools/query_project";
export { wikiSearch } from "./tools/wiki-search";
export { readModule } from "./tools/read-module";
export { detectDrift } from "./tools/detect-drift";

// Support module — used by queryWiki and exported so studio can register
// synthesize_answer as a standalone MCP tool without duplicating the logic:
export { synthesizeAnswer } from "./tools/answer-synthesis";

// Infrastructure:
export * from "./types";
export * from "./filesystem";
export * from "./language-map";
export * from "./extractor";
export * from "./extractor-rules";
export * from "./extractor-stoplist";
export * from "./category-dir";
