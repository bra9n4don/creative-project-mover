import { useState, type ReactNode } from "react";
import { Check, Circle, CircleDot, Lock } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/lib/router-compat";
import { AppShell } from "@/components/shell";
import { ErrorBlock, LoadingBlock, PageHeader, Panel, ago, btn } from "@/components/kit";
import { usePageTitle } from "@/lib/workspace";
import { useOnboarding } from "@/lib/use-onboarding";
import { PUBLISHED_URL, type StepState } from "@/lib/hub/onboarding";
import { cn } from "@/lib/utils";

function Step({ n, state, title, children }: { n: number; state: StepState; title: string; children: ReactNode }) {
  const Icon = state === "done" ? Check : state === "partial" ? CircleDot : state === "blocked" ? Lock : Circle;
  return (
    <li data-testid={`setup-step-${n}`} data-state={state} className={cn("flex gap-4 border-b p-5 last:border-0", state === "blocked" && "opacity-60")}>
      <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border", state === "done" && "border-primary bg-primary text-primary-foreground", state === "partial" && "border-primary text-primary")}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-lg font-semibold">{n}. {title}</div>
        <div className="mt-1 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

export default function SetupPage() {
  usePageTitle("Setup");
  const { steps, progress, isLoading, host, claimNow, connections, claimError, retryClaim } = useOnboarding();
  const [claiming, setClaiming] = useState(false);
  const onPublished = steps.published === "done";

  return (
    <AppShell>
      <PageHeader eyebrow={`Owner setup · ${progress.done}/${progress.total}`} title="Set up Relay" lede="Get your published workspace ready: your account, ownership, and fresh tokens for your AI tools." />
      {claimError ? <ErrorBlock error={claimError} onRetry={retryClaim} /> : isLoading ? <LoadingBlock rows={3} /> : (
        <Panel>
          <ol>
            <Step n={1} state={steps.account} title="Create your account">
              {steps.account === "done" ? <p>You're signed in with a confirmed email.</p>
                : steps.account === "partial" ? <p>Check your inbox and click the confirmation link, then come back here.</p>
                : <div className="flex flex-wrap gap-2"><Link href="/sign-up" className={btn.primary}>Create account</Link><Link href="/sign-in" className={btn.ghost}>Sign in</Link></div>}
            </Step>
            <Step n={2} state={steps.claim} title="Claim the workspace">
              {steps.claim === "done" ? <p>This workspace is yours. Nobody else can sign in to it.</p>
                : steps.claim === "blocked" && steps.account === "done" ? <p className="text-destructive">This workspace already belongs to another account. Sign in with the owner's account instead.</p>
                : steps.claim === "blocked" ? <p>Finish step 1 first. The first confirmed account to claim becomes the only owner.</p>
                : (<>
                    <p>The first confirmed account to claim becomes the only owner. This can't be handed over later.</p>
                    <button className={btn.primary} disabled={claiming} data-testid="button-claim" onClick={async () => {
                      setClaiming(true);
                      try { (await claimNow()) ? toast.success("Workspace claimed") : toast.error("Someone else already owns this workspace"); }
                      catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't claim"); }
                      finally { setClaiming(false); }
                    }}>Claim workspace</button>
                  </>)}
            </Step>
            <Step n={3} state={steps.published} title="Use the published address">
              <p>{onPublished ? `You're on the live site (${host}).` : `You're on ${host || "the preview"}. AI tools should point at the live site so they keep working.`}</p>
              {!onPublished && steps.published !== "blocked" && <a href={`${PUBLISHED_URL}/setup`} className={btn.ghost}>Open live site</a>}
            </Step>
            <Step n={4} state={steps.tokens} title="Reconnect your AI tools">
              <p>Tokens from the old Replit version no longer work. Issue a new token for each tool you use. This step is done once a tool checks in.</p>
              {connections.filter((c) => c.status !== "not_configured").length > 0 && (
                <ul className="space-y-1">
                  {connections.filter((c) => c.status !== "not_configured").map((c) => (
                    <li key={c.id}>{c.name}: {c.lastSeen ? `checked in ${ago(c.lastSeen)}` : "token issued, waiting for first check-in"}</li>
                  ))}
                </ul>
              )}
              {steps.tokens !== "blocked" && <Link href="/connections" className={btn.primary}>Issue tokens</Link>}
            </Step>
            <Step n={5} state={steps.github} title="Optional: GitHub sync">
              <p>Press "Sync now" once in Settings to turn on automatic hourly sync.</p>
              {steps.github === "todo" && <Link href="/settings" className={btn.ghost}>Open Settings</Link>}
            </Step>
          </ol>
        </Panel>
      )}
    </AppShell>
  );
}
