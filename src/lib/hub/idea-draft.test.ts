import { describe, expect, it } from "vitest";
import { IDEA_INPUT_LIMIT, ideaDraftSchema, reviewedIdeaDraftSchema } from "./idea-draft";

const validDraft = {
  summary: "A small app that turns grocery receipts into a weekly meal plan.",
  tasks: [{ title: "Sketch the receipt upload flow", description: "Decide how photos become line items." }],
  risks: ["Receipt OCR quality varies by store."],
  openQuestions: ["Which stores should the first version support?"],
};

describe("ideaDraftSchema", () => {
  it("accepts a well-formed AI draft", () => {
    expect(ideaDraftSchema.parse(validDraft)).toEqual(validDraft);
  });

  it("rejects drafts with unexpected fields", () => {
    expect(ideaDraftSchema.safeParse({ ...validDraft, projectId: "p1" }).success).toBe(false);
  });
});

describe("reviewedIdeaDraftSchema", () => {
  it("accepts a reviewed draft within limits", () => {
    expect(reviewedIdeaDraftSchema.parse(validDraft).summary).toBe(validDraft.summary);
  });

  it("rejects an empty summary", () => {
    expect(reviewedIdeaDraftSchema.safeParse({ ...validDraft, summary: "  " }).success).toBe(false);
  });

  it("caps tasks at 6 and risks/questions at 5", () => {
    const task = { title: "t", description: "d" };
    expect(reviewedIdeaDraftSchema.safeParse({ ...validDraft, tasks: Array(7).fill(task) }).success).toBe(false);
    expect(reviewedIdeaDraftSchema.safeParse({ ...validDraft, risks: Array(6).fill("r") }).success).toBe(false);
    expect(reviewedIdeaDraftSchema.safeParse({ ...validDraft, openQuestions: Array(6).fill("q") }).success).toBe(false);
  });

  it("rejects over-long fields", () => {
    expect(reviewedIdeaDraftSchema.safeParse({ ...validDraft, summary: "x".repeat(2001) }).success).toBe(false);
    expect(reviewedIdeaDraftSchema.safeParse({ ...validDraft, tasks: [{ title: "x".repeat(201), description: "" }] }).success).toBe(false);
  });
});

describe("IDEA_INPUT_LIMIT", () => {
  it("stays at 4,000 characters", () => {
    expect(IDEA_INPUT_LIMIT).toBe(4000);
  });
});
