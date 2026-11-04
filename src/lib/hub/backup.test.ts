import { describe, expect, it } from "vitest";
import { backupFiles, gitBlobSha, toBase64 } from "./backup";
import { emptyState } from "./store";

describe("GitHub backup", () => {
  it("includes projects, ideas and checkpoints but not activity", () => {
    const s = emptyState();
    s.ideas.push({ id: "i1", title: "Idea A" } as never);
    s.activity.push({ id: "a1", title: "Noise" } as never);
    const f = backupFiles(s);
    const json = JSON.parse(f["workspace.json"]!);
    expect(Object.keys(json)).toEqual(["projects", "tasks", "ideas", "checkpoints"]);
    expect(f["workspace.md"]).toContain("- Idea A");
    expect(f["workspace.json"]).not.toContain("Noise");
  });
  it("computes git blob shas like git does", async () => {
    // `printf 'hello\n' | git hash-object --stdin`
    expect(await gitBlobSha("hello\n")).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
  });
  it("base64-encodes unicode", () => {
    expect(atob(toBase64("—"))).toBe("\u00e2\u0080\u0094");
  });
});
