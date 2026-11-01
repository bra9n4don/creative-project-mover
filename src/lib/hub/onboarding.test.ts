import { describe, expect, it } from "vitest";
import { onboardingProgress, onboardingSteps, type OnboardingInput } from "./onboarding";

const base: OnboardingInput = { signedIn: true, emailConfirmed: true, claimed: true, isOwner: true, host: "carterlab.app", tokens: [], githubSynced: false };

describe("onboarding checklist", () => {
  it("someone else owning the workspace blocks every later step", () => {
    const s = onboardingSteps({ ...base, isOwner: false });
    expect(s.claim).toBe("blocked");
    expect(s.tokens).toBe("blocked");
    expect(s.published).toBe("blocked");
  });
  it("an issued token is only done once the tool has checked in", () => {
    expect(onboardingSteps({ ...base, tokens: [{ status: "configured", lastSeen: null }] }).tokens).toBe("partial");
    expect(onboardingSteps({ ...base, tokens: [{ status: "verified", lastSeen: "2026-11-01T00:00:00Z" }] }).tokens).toBe("done");
  });
  it("unconfirmed email cannot claim yet", () => {
    expect(onboardingSteps({ ...base, emailConfirmed: false, claimed: false, isOwner: false }).claim).toBe("blocked");
  });
  it("preview address is not the published one", () => {
    expect(onboardingSteps({ ...base, host: "localhost:8080" }).published).toBe("todo");
  });
  it("GitHub is optional for completion", () => {
    const s = onboardingSteps({ ...base, tokens: [{ status: "verified", lastSeen: "x" }] });
    expect(onboardingProgress(s)).toEqual({ done: 4, total: 4, complete: true });
  });
});

import { isPublishedHost } from "./onboarding";
describe("live address", () => {
  it("recognises carterlab.app as the live site", () => {
    expect(isPublishedHost("carterlab.app")).toBe(true);
    expect(isPublishedHost("carterhomelab.dev")).toBe(false);
  });
});
