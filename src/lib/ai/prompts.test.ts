import { describe, expect, it } from "vitest";
import { compact } from "./prompts";
describe("AI input compaction", () => {
  it("drops empty answers and keeps real ones", () => {
    expect(compact({ brainstorm: "Idea", answers: { goal: "Ship", budget: "  ", risks: "" }, brief: undefined, list: [] })).toEqual({ brainstorm: "Idea", answers: { goal: "Ship" } });
  });
});
