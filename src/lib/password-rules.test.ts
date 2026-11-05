import { describe, expect, it } from "vitest";
import { checkNewPassword } from "./password-rules";

describe("new password rule", () => {
  it("rejects 11 characters", () => expect(checkNewPassword("a".repeat(11))).not.toBeNull());
  it("accepts 12 characters", () => expect(checkNewPassword("a".repeat(12))).toBeNull());
  it("rejects mismatched confirm", () => expect(checkNewPassword("a".repeat(12), "b".repeat(12))).not.toBeNull());
  it("rejects reusing the current password", () => expect(checkNewPassword("a".repeat(12), undefined, "a".repeat(12))).not.toBeNull());
});
