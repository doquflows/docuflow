import { describe, it, expect } from "vitest";
import { passesEntityRules, type EntityCandidate } from "../extractor-rules";

function ok(c: Partial<EntityCandidate> & { name: string }): EntityCandidate {
  return {
    type: "entity",
    source: "bold",
    context: "This is a full sentence that provides enough context for the candidate.",
    ...c,
  };
}

describe("passesEntityRules", () => {
  // ── Rule 1: Structural anchor ──────────────────────────────────────────────

  describe("Rule 1 — structural anchor", () => {
    it("accepts heading candidates regardless of context", () => {
      const c = ok({ name: "Foo", source: "heading", context: "" });
      expect(passesEntityRules(c).ok).toBe(true);
    });

    it("rejects bold text in bare bullet with no sentence context", () => {
      const c = ok({ name: "FooBar", source: "bold", context: "- FooBar" });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/bare bullet/);
    });

    it("accepts bold text with surrounding prose (≥4 words in context)", () => {
      const c = ok({ name: "FooBar", source: "bold", context: "FooBar is the main orchestrator for routing decisions." });
      expect(passesEntityRules(c).ok).toBe(true);
    });
  });

  // ── Rule 2: Minimum token signal ──────────────────────────────────────────

  describe("Rule 2 — minimum token signal", () => {
    it("accepts multi-word names", () => {
      const c = ok({ name: "Entity Extractor", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(true);
    });

    it("accepts camelCase single word", () => {
      const c = ok({ name: "WikiPage", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(true);
    });

    it("accepts identifier with underscore", () => {
      const c = ok({ name: "ingest_source", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(true);
    });

    it("rejects single generic lowercase word", () => {
      const c = ok({ name: "server", source: "bold", context: "The server handles all requests coming in from the agent." });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/single generic word/);
    });
  });

  // ── Rule 3: Stop-list ──────────────────────────────────────────────────────

  describe("Rule 3 — stop-list rejection", () => {
    it("rejects 'true'", () => {
      const c = ok({ name: "true", source: "heading" });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/stop-list/);
    });

    it("rejects 'any'", () => {
      const c = ok({ name: "any", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(false);
    });

    it("rejects 'todo'", () => {
      const c = ok({ name: "todo", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(false);
    });

    it("accepts a meaningful domain term", () => {
      const c = ok({ name: "WikiCategory", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(true);
    });
  });

  // ── Rule 4: No emoji/punct-only slug ──────────────────────────────────────

  describe("Rule 4 — no emoji or punctuation-only slugs", () => {
    it("rejects emoji-only name", () => {
      const c = ok({ name: "🚀", source: "heading" });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/slug/);
    });

    it("accepts name that has text after emoji", () => {
      const c = ok({ name: "DocuFlow MCP", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(true);
    });
  });

  // ── Rule 5: Context requirement ────────────────────────────────────────────

  describe("Rule 5 — context requirement", () => {
    it("skips context check for headings", () => {
      const c = ok({ name: "WikiEngine", source: "heading", context: "" });
      expect(passesEntityRules(c).ok).toBe(true);
    });

    it("rejects bold text with no long sentence in context", () => {
      const c = ok({ name: "DocuFlow MCP", source: "bold", context: "DocuFlow MCP. Short." });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/context/);
    });

    it("accepts bold text with a proper sentence in context", () => {
      const c = ok({
        name: "DocuFlow MCP",
        source: "bold",
        context: "DocuFlow MCP is the primary server-side component that handles all wiki management operations.",
      });
      expect(passesEntityRules(c).ok).toBe(true);
    });
  });

  // ── Garbage patterns from real noise ──────────────────────────────────────

  describe("known garbage patterns", () => {
    const garbage = [
      { name: "any", source: "heading" as const },
      { name: "add", source: "heading" as const },
      { name: "true", source: "bold" as const },
      { name: "false", source: "bold" as const },
      { name: "done", source: "heading" as const },
      { name: "allowed", source: "bold" as const },
    ];

    for (const g of garbage) {
      it(`rejects "${g.name}"`, () => {
        const c = ok(g);
        expect(passesEntityRules(c).ok).toBe(false);
      });
    }
  });

  // ── Legitimate entity patterns ─────────────────────────────────────────────

  describe("legitimate entities pass", () => {
    const good = [
      { name: "WikiCategory", source: "heading" as const },
      { name: "ingest_source", source: "heading" as const },
      { name: "MCP Server", source: "heading" as const },
      { name: "DocuFlow", source: "bold" as const, context: "DocuFlow is the core AI documentation assistant that powers all wiki operations in the repository." },
      { name: "LLM Wiki Pattern", source: "heading" as const },
    ];

    for (const g of good) {
      it(`accepts "${g.name}"`, () => {
        const c = ok(g);
        expect(passesEntityRules(c).ok).toBe(true);
      });
    }
  });

  // ── Rule 1 — multi-word all-stop-list rejection ────────────────────────────

  describe("Rule 1 — multi-word stop-list", () => {
    it("rejects 'key components' (both words generic)", () => {
      const c = ok({ name: "Key Components", source: "heading" });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/stop-list/);
    });

    it("rejects 'core modules'", () => {
      const c = ok({ name: "Core Modules", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(false);
    });

    it("rejects 'getting started' (whole-phrase stop-list)", () => {
      const c = ok({ name: "Getting Started", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(false);
    });

    it("accepts 'Claude Desktop' (one word not on stop-list)", () => {
      const c = ok({ name: "Claude Desktop", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(true);
    });
  });

  // ── Rule 6 — section-heading noise ─────────────────────────────────────────

  describe("Rule 6 — section-heading noise patterns", () => {
    it("rejects numbered list items", () => {
      const c = ok({ name: "1. Documentation Goes Stale", source: "heading" });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/numbered list/);
    });

    it("rejects '2) Foo Bar'", () => {
      const c = ok({ name: "2) Foo Bar", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(false);
    });

    it("rejects file references ending in .md", () => {
      const c = ok({ name: "synthesis_architecture_overview.md", source: "bold", context: "See synthesis_architecture_overview.md for a deeper dive into the topic and trade-offs." });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/file reference/);
    });

    it("rejects file references ending in .ts", () => {
      const c = ok({ name: "extractor.ts", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(false);
    });

    it("rejects question-form headings", () => {
      const c = ok({ name: "What is DocuFlow", source: "heading" });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/question/);
    });

    it("rejects 'How it works'", () => {
      const c = ok({ name: "How it works", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(false);
    });

    it("rejects preposition-led phrases", () => {
      const c = ok({ name: "For Using DocuFlow", source: "heading" });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/preposition/);
    });

    it("rejects layer/phase markers", () => {
      const c = ok({ name: "Layer 1: Raw Sources", source: "heading" });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/layer\/phase/);
    });

    it("rejects 'Phase 2 Testing'", () => {
      const c = ok({ name: "Phase 2 Testing", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(false);
    });

    it("rejects sentence-form 'DocuFlow is not a documentation generator'", () => {
      const c = ok({ name: "DocuFlow is not a documentation generator", source: "heading" });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/sentence/);
    });

    it("accepts a real heading entity like 'MCP Server'", () => {
      const c = ok({ name: "MCP Server", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(true);
    });

    it("rejects emoji-led titles like '🔧 .devloop/ Storage'", () => {
      const c = ok({ name: "🔧 .devloop/ Storage", source: "heading" });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/emoji|punctuation/);
    });

    it("rejects '❌ Hiding the knowledge base from humans'", () => {
      const c = ok({ name: "❌ Hiding the knowledge base from humans", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(false);
    });

    it("rejects 'The Core Thesis' (the-X descriptive)", () => {
      const c = ok({ name: "The Core Thesis", source: "heading" });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/descriptive reference/);
    });

    it("rejects 'The LLM Wiki Pattern' (the-X descriptive)", () => {
      const c = ok({ name: "The LLM Wiki Pattern", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(false);
    });

    it("rejects 'Date: 2026-04-27' (date metadata)", () => {
      const c = ok({ name: "Date: 2026-04-27", source: "heading" });
      const r = passesEntityRules(c);
      expect(r.ok).toBe(false);
      expect((r as any).reason).toMatch(/date/);
    });

    it("rejects bare ISO date '2026-04-27'", () => {
      const c = ok({ name: "2026-04-27", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(false);
    });

    it("accepts version strings like 'v1.5.2' (not a date)", () => {
      const c = ok({ name: "v1.5.2", source: "heading" });
      expect(passesEntityRules(c).ok).toBe(true);
    });
  });
});
