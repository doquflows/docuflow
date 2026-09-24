export type WikiCategory = "entity" | "concept" | "timeline" | "synthesis";

const CATEGORY_PLURAL: Record<WikiCategory, string> = {
  entity: "entities",
  concept: "concepts",
  timeline: "timelines",
  synthesis: "syntheses",
};

export function categoryDir(category: WikiCategory): string {
  return CATEGORY_PLURAL[category];
}
