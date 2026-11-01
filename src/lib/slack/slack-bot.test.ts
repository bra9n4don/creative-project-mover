import { describe, it, expect } from "vitest";
import { handleMessage } from "./bot";
import { emptyState } from "@/lib/hub/store";

describe("slack bot", () => {
  it("turns `idea <text>` into an idea, ignoring the mention", () => {
    const a = handleMessage("<@U123> idea offline mode", emptyState());
    expect(a.idea?.title).toBe("offline mode");
  });
  it("does not save an idea for other messages", () => {
    expect(handleMessage("hello", emptyState()).idea).toBeUndefined();
  });
});
