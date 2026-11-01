/** Pure step logic for the owner setup checklist (browser-safe). */
export const PUBLISHED_HOSTS = ["creative-project-mover.lovable.app", "carterhomelab.dev", "www.carterhomelab.dev"];
export const PUBLISHED_URL = "https://creative-project-mover.lovable.app";

export type OnboardingInput = {
  signedIn: boolean;
  emailConfirmed: boolean;
  claimed: boolean;
  isOwner: boolean;
  host: string;
  tokens: { status: "not_configured" | "configured" | "verified"; lastSeen: string | null }[];
  githubSynced: boolean;
};
export type StepState = "done" | "partial" | "todo" | "blocked";
export type StepId = "account" | "claim" | "published" | "tokens" | "github";

export function isPublishedHost(host: string) {
  return PUBLISHED_HOSTS.includes(host.toLowerCase());
}

export function onboardingSteps(i: OnboardingInput): Record<StepId, StepState> {
  const account: StepState = i.signedIn && i.emailConfirmed ? "done" : i.signedIn ? "partial" : "todo";
  const claimedByOther = i.claimed && !i.isOwner;
  const claim: StepState = i.isOwner ? "done" : claimedByOther ? "blocked" : account === "done" ? "todo" : "blocked";
  const locked = !i.isOwner;
  const published: StepState = locked ? "blocked" : isPublishedHost(i.host) ? "done" : "todo";
  const issued = i.tokens.filter((t) => t.status !== "not_configured");
  const tokens: StepState = locked ? "blocked" : issued.some((t) => !!t.lastSeen) ? "done" : issued.length ? "partial" : "todo";
  const github: StepState = locked ? "blocked" : i.githubSynced ? "done" : "todo";
  return { account, claim, published, tokens, github };
}

/** Required steps (GitHub is optional). */
export function onboardingProgress(s: Record<StepId, StepState>) {
  const req: StepId[] = ["account", "claim", "published", "tokens"];
  const done = req.filter((k) => s[k] === "done").length;
  return { done, total: req.length, complete: done === req.length };
}
