import { describe, expect, it } from "vitest";
import { isOwnerSlackEvent, OWNER_SLACK } from "./owner";
describe("Slack bot owner check", () => {
  it("accepts only Brandon in Carter Home Lab", () => {
    expect(isOwnerSlackEvent(OWNER_SLACK.teamId, OWNER_SLACK.userId)).toBe(true);
    expect(isOwnerSlackEvent(OWNER_SLACK.teamId, "U999OTHER")).toBe(false);
    expect(isOwnerSlackEvent("TOTHER", OWNER_SLACK.userId)).toBe(false);
    expect(isOwnerSlackEvent(undefined, undefined)).toBe(false);
  });
});
