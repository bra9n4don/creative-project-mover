import { Link } from "@/lib/router-compat";
import { LogOut, ShieldCheck } from "lucide-react";
import { useClerk, useUser } from "@/lib/auth";
import { AppShell } from "@/components/shell";
import { ErrorBlock, LoadingBlock, PageHeader, Panel, btn } from "@/components/kit";
import { usePageTitle, useWorkspace } from "@/lib/workspace";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const rules = [
  "AI tools can read plans, add tasks, report work as done, capture ideas and save checkpoints.",
  "Only you mark a task verified, and only with evidence.",
  "Deleting anything, approving proposed changes and issuing tokens happen only here, in your signed-in browser.",
  "GitHub is read only. Relay never merges, pushes or deploys.",
  "Every plan edit carries a version number, so two tools can't silently overwrite each other.",
];

export default function SettingsPage() {
  usePageTitle("Settings");
  const { state, isLoading, error, refetch, isDemo } = useWorkspace();
  const { user } = useUser();
  const { signOut } = useClerk();
  return (
    <AppShell>
      <PageHeader eyebrow="Behind the scenes" title="Settings" />
      {isLoading ? <LoadingBlock rows={2} /> : error || !state ? <ErrorBlock error={error} onRetry={refetch} /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Automation guardrails">
            <div className="p-5">
              <div className="mb-4 flex items-start gap-3 rounded-xl bg-accent/10 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <p className="whitespace-pre-line text-sm leading-relaxed" data-testid="text-policy">{state.policy || "Guarded: sensitive changes wait for your approval."}</p>
              </div>
              <ul className="space-y-2.5 text-sm">
                {rules.map((r) => <li key={r} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />{r}</li>)}
              </ul>
            </div>
          </Panel>
          <Panel title="Account">
            <div className="p-5">
              {isDemo ? (
                <>
                  <p className="text-sm text-muted-foreground">You're in the preview. Relay is a single-owner space: the first account you create, with a verified email that matches your linked GitHub account, becomes the owner.</p>
                  <div className="mt-4 flex gap-2">
                    <Link href="/sign-up" className={btn.primary} data-testid="link-settings-signup">Create my workspace</Link>
                    <Link href="/sign-in" className={btn.ghost} data-testid="link-settings-signin">Sign in</Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-lg font-medium" data-testid="text-user-name">{user?.fullName || "Owner"}</div>
                  <div className="font-mono text-sm text-muted-foreground" data-testid="text-user-email">{user?.primaryEmailAddress?.emailAddress}</div>
                  <p className="mt-3 text-sm text-muted-foreground">This workspace belongs to you alone. Nobody else can sign in to it.</p>
                  <button className={`${btn.ghost} mt-5`} data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: basePath || "/" })}>
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </>
              )}
            </div>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
