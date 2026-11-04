import { describe, expect, it } from "vitest";
import { assistantUsage } from "./usage";

const at = (d: number) => `2026-11-0${d}T00:00:00.000Z`;

describe("assistantUsage", () => {
  it("counts checkpoints, tasks and ideas per assistant and skips your own saves", () => {
    const rows = assistantUsage({
      handoffs: [{ source: "Claude", createdAt: at(1) }, { source: "Claude", createdAt: at(3) }, { source: "You · Kickoff", createdAt: at(2) }, { source: "ChatGPT", createdAt: at(2) }] as never,
      tasks: [{ agent: "ChatGPT", createdAt: at(4) }, { agent: "", createdAt: at(1) }] as never,
      ideas: [{ source: "You", createdAt: at(1) }, { source: "Claude", createdAt: at(2) }] as never,
    });
    expect(rows).toEqual([
      { source: "Claude", checkpoints: 2, tasks: 0, ideas: 1, total: 3, lastActive: at(3) },
      { source: "ChatGPT", checkpoints: 1, tasks: 1, ideas: 0, total: 2, lastActive: at(4) },
    ]);
  });
});
