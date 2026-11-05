import { describe, expect, it } from "vitest";
import { hasPendingLink, savePendingLink, takePendingLink } from "./pending-link";

function mem(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size; } } as Storage;
}

describe("pending link code", () => {
  it("is returned once, then cleared", () => {
    const s = mem();
    savePendingLink(s, "ABCD-1234", "google", 0);
    expect(takePendingLink(s, 1000)?.code).toBe("ABCD-1234");
    expect(takePendingLink(s, 1000)).toBeNull();
    expect(hasPendingLink(s)).toBe(false);
  });
  it("is dropped after 10 minutes", () => {
    const s = mem();
    savePendingLink(s, "ABCD-1234", "microsoft", 0);
    expect(takePendingLink(s, 10 * 60 * 1000 + 1)).toBeNull();
    expect(hasPendingLink(s)).toBe(false);
  });
});
