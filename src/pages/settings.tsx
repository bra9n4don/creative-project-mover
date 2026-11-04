import { Link } from "@/lib/router-compat";
import { LogOut, ShieldCheck, RefreshCw, Github } from "lucide-react";
import { startTour } from "@/components/guided-tour";
import { ThemeSettings } from "@/components/theme-controls";
import { useBackupNow, useGithubSyncStatus, useSyncGithub } from "@/lib/hub-api";
import { useHubResult } from "@/lib/workspace";
import { ago } from "@/components/kit";
import { useClerk, useUser } from "@/lib/auth";
import { AppShell } from "@/components/shell";
import { InstallSteps } from "@/components/ios-install";
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
                  <p className="text-sm text-muted-foreground">You're in the preview. Relay is a single-owner space: the first account to sign in with a verified email becomes the owner.</p>
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
          {!isDemo && <GithubSyncPanel />}
          {!isDemo && <GithubBackupPanel />}
          <Panel title="Appearance"><ThemeSettings /></Panel>
          {!isDemo && <Panel title="Tutorial">
            <div className="p-5 text-sm">
              <p className="text-muted-foreground">Take the quick guided tour of Relay again.</p>
              <button className={`${btn.ghost} mt-4`} data-testid="button-replay-tour" onClick={startTour}>Take the tour again</button>
            </div>
          </Panel>}
          <Panel title="Install on iPhone">
            <div className="p-5">
              <p className="mb-4 text-sm text-muted-foreground">Relay opens full screen from your Home Screen, like an app. No App Store needed.</p>
              <InstallSteps />
            </div>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}

function GithubBackupPanel() {
  const status = useGithubSyncStatus({ query: { refetchInterval: 300000 } });
  const backup = useBackupNow();
  const result = useHubResult();
  const s = status.data;
  const headline = !s ? "Checking…" : !s.githubConnected ? "GitHub isn't connected" : s.lastBackupOk === false ? "Last backup failed" : s.lastBackupAt ? "Backing up after every save" : "No backup yet";
  return (
    <Panel title="GitHub backup · private repo">
      <div className="p-5 text-sm" data-testid="panel-github-backup">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${s?.lastBackupOk ? "bg-accent" : s?.lastBackupOk === false ? "bg-destructive" : "bg-muted-foreground/40"}`} />
          <div className="font-medium" data-testid="text-backup-headline">{headline}</div>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-muted-foreground">
          <dt>Repository</dt><dd className="min-w-0 text-foreground">{s?.backupRepo ? <a className="underline" href={`https://github.com/${s.backupRepo}`} target="_blank" rel="noreferrer">{s.backupRepo}</a> : "Created on first backup"}</dd>
          <dt>Last backup</dt><dd className="text-foreground" data-testid="text-last-backup">{s?.lastBackupAt ? ago(s.lastBackupAt) : "Never"}</dd>
          {s?.lastBackupMessage && <><dt>Result</dt><dd className={s.lastBackupOk === false ? "text-destructive" : "text-foreground"}>{s.lastBackupMessage}</dd></>}
        </dl>
        <button className={`${btn.ghost} mt-5`} disabled={backup.isPending || !s?.githubConnected} data-testid="button-backup-now"
          onClick={() => backup.mutate(undefined, result("Backed up to GitHub", () => void status.refetch()))}>
          <RefreshCw className={`h-4 w-4 ${backup.isPending ? "animate-spin" : ""}`} /> Back up now
        </button>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Github className="h-3.5 w-3.5" />Projects, tasks, ideas and checkpoints go to a private repo only you can see. Share it by inviting people on GitHub.</p>
      </div>
    </Panel>
  );
}

function GithubSyncPanel() {
  const status = useGithubSyncStatus({ query: { refetchInterval: 300000 } });
  const sync = useSyncGithub();
  const result = useHubResult();
  const s = status.data;
  if (!s && status.error) return (
    <Panel title="GitHub sync · read only"><div className="p-5 text-sm" role="alert">
      <p className="text-destructive">Couldn't check the GitHub sync status. Your GitHub connection may be fine.</p>
      <button className={`${btn.ghost} mt-3`} onClick={() => void status.refetch()}><RefreshCw className="h-4 w-4" /> Try again</button>
    </div></Panel>);
  const minutesSince = s?.lastSyncAt ? (Date.now() - +new Date(s.lastSyncAt)) / 60000 : null;
  const healthy = !!s?.autoSyncEnabled && s.lastSyncOk === true && minutesSince !== null && minutesSince < s.intervalMinutes * 2 + 2;
  const headline = !s ? "Checking…"
    : !s.githubConnected ? "GitHub isn't connected"
    : !s.autoSyncEnabled ? "Automatic sync is off until your first sync"
    : s.lastSyncOk === false ? "Last sync failed"
    : healthy ? "Automatic sync is working"
    : "Waiting for the next automatic sync";
  return (
    <Panel title="GitHub sync · read only">
      <div className="p-5 text-sm" data-testid="panel-github-sync">
        {s && status.error && <p role="alert" className="mb-3 text-destructive">Couldn't refresh the sync status, so this may be out of date. <button className="underline" onClick={() => void status.refetch()}>Try again</button></p>}
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${healthy ? "bg-accent" : s?.lastSyncOk === false || (s && !s.githubConnected) ? "bg-destructive" : "bg-muted-foreground/40"}`} />
          <div className="font-medium" data-testid="text-sync-headline">{headline}</div>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-muted-foreground">
          <dt>GitHub account</dt><dd className="text-foreground">{s?.githubConnected ? "Connected securely" : "Not connected"}</dd>
          <dt>Runs</dt><dd className="text-foreground">{s?.autoSyncEnabled ? s.intervalMinutes === 60 ? "Every hour, on the hour · results can be up to an hour old" : `Every ${s.intervalMinutes} minutes` : "After your first sync"}</dd>
          <dt>Last sync</dt><dd className="text-foreground" data-testid="text-last-sync">{s?.lastSyncAt ? `${ago(s.lastSyncAt)} · ${s.lastSyncTrigger === "automatic" ? "automatic" : "by you"}` : "Never"}</dd>
          {s?.lastSyncMessage && <><dt>Result</dt><dd className={s.lastSyncOk === false ? "text-destructive" : "text-foreground"}>{s.lastSyncMessage}</dd></>}
        </dl>
        <button className={`${btn.ghost} mt-5`} disabled={sync.isPending || !s?.githubConnected} data-testid="button-run-sync"
          onClick={() => sync.mutate(undefined, result("GitHub synced", () => void status.refetch()))}>
          <RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} /> Sync now
        </button>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Github className="h-3.5 w-3.5" />Reads commits and pull requests for linked projects. Never changes your repositories.</p>
      </div>
    </Panel>
  );
}
