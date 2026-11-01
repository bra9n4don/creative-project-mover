import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkpointShape, ideaShape } from "./schemas";
import { UPDATE_INPUT_LIMIT } from "@/lib/hub/update-draft";

describe("assistant and update limits", () => {
  it("assistant idea details cap at 2,000 characters", () => {
    const s = z.object(ideaShape);
    expect(s.safeParse({ title: "a", description: "x".repeat(2000) }).success).toBe(true);
    expect(s.safeParse({ title: "a", description: "x".repeat(2001) }).success).toBe(false);
  });
  it("checkpoint next action caps at 1,000 characters", () => {
    const s = z.object(checkpointShape);
    const base = { projectId: "p", title: "t", summary: "s" };
    expect(s.safeParse({ ...base, nextAction: "x".repeat(1000) }).success).toBe(true);
    expect(s.safeParse({ ...base, nextAction: "x".repeat(1001) }).success).toBe(false);
  });
  it("project update paste limit is 8,000", () => {
    expect(UPDATE_INPUT_LIMIT).toBe(8000);
  });
});
