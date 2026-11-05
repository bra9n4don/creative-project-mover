import { describe, expect, it } from "vitest";
import { emptyIdeaIssues, mergeIssuesIntoIdeas } from "./idea-issues";
import type { Idea } from "./types";

describe("mergeIssuesIntoIdeas", () => {
  it("adds each new open issue once as an inbox idea and skips linked ones", () => {
    const ideas: Idea[] = []; const cfg = { ...emptyIdeaIssues(), repo: "a/b" };
    let n = 0; const id = () => `id${++n}`;
    const issues = [{ number: 1, title: "One", body: "b", url: "u1" }, { number: 2, title: "Two", body: "", url: "u2" }];
    expect(mergeIssuesIntoIdeas(ideas, cfg, issues, "now", id)).toBe(2);
    expect(ideas.map(i => i.status)).toEqual(["inbox", "inbox"]);
    expect(mergeIssuesIntoIdeas(ideas, cfg, issues, "now", id)).toBe(0);
    expect(ideas).toHaveLength(2);
    expect(cfg.links.map(l => l.number)).toEqual([1, 2]);
  });
});
