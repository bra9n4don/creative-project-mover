import { useState } from "react";
import { AlertTriangle, BookOpen, ChevronDown, Download, KeyRound, Plug } from "lucide-react";
import { useHealthCheck, useIssueAgentToken, useRevokeAgentToken, type Connection, type TokenResult } from "@workspace/api-client-react";
import { AppShell } from "@/components/shell";
import { Confirm, CopyButton, ErrorBlock, LoadingBlock, PageHeader, Pill, ago, btn } from "@/components/kit";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errMessage, useHubResult, usePageTitle, useWorkspace } from "@/lib/workspace";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const origin = window.location.origin;
const host = window.location.hostname;
const isDev = /\.replit\.dev$|localhost|127\.0\.0\.1|-00-/.test(host);
const mcpUrl = `${origin}/api/mcp`;

const nativeSnippet = JSON.stringify({ mcpServers: { relay: { type: "http", url: mcpUrl, headers: { Authorization: "Bearer YOUR_RELAY_TOKEN" } } } }, null, 2);
const bridgeSnippet = JSON.stringify(
  { mcpServers: { relay: { command: "npx", args: ["-y", "mcp-remote", mcpUrl, "--header", "Authorization:Bearer ${RELAY_TOKEN}"], env: { RELAY_TOKEN: "YOUR_RELAY_TOKEN" } } } },
  null,
  2,
);
const restSnippet = `curl -H "Authorization: Bearer YOUR_RELAY_TOKEN" ${origin}/api/hub/state`;

function cautionFor(c: Connection): string | null {
  const n = `${c.id} ${c.name}`.toLowerCase();
  if (n.includes("chatgpt") || n.includes("openai"))
    return "ChatGPT custom connectors need a public HTTPS URL (publish first) and may not accept custom bearer headers on every plan. Never paste your token into a chat message.";
  if (n.includes("claude"))
    return "Claude Desktop cannot send bearer headers directly: use the mcp-remote bridge in claude_desktop_config.json and restart Claude. Claude Code can add it natively with --transport http and --header.";
  if (n.includes("gemini"))
    return "Use Gemini CLI (~/.gemini/settings.json, httpUrl + headers). The Gemini web app does not load custom MCP servers.";
  if (n.includes("copilot"))
    return "In VS Code, put Relay in .vscode/mcp.json using an input variable for the token so it never lands in a committed file.";
  return null;
}

function TokenDialog({ token, name, onClose }: { token: TokenResult | null; name: string; onClose: () => void }) {
  return (
    <Dialog open={!!token} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Token for {name}</DialogTitle>
          <DialogDescription>Shown once. Relay keeps only a fingerprint, so copy it into {name} now. It expires {token ? new Date(token.expiresAt).toLocaleDateString() : ""}.</DialogDescription>
        </DialogHeader>
        <div className="break-all rounded-lg border-2 border-primary/40 bg-primary/5 p-3 font-mono text-sm" data-testid="text-token">{token?.token}</div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Replace YOUR_RELAY_TOKEN in the config with this.</span>
          {token && <CopyButton text={token.token} label="Copy token" testId="button-copy-token" />}
        </div>
        <button className={btn.ink} onClick={onClose} data-testid="button-token-done">I've stored it</button>
      </DialogContent>
    </Dialog>
  );
}

function ConnectionCard({ c }: { c: Connection }) {
  const { guard } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<TokenResult | null>(null);
  const issue = useIssueAgentToken();
  const revoke = useRevokeAgentToken();
  const result = useHubResult();
  const { toast } = useToast();
  const caution = cautionFor(c);
  const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
  return (
    <article data-testid={`card-connection-${c.id}`} className="rise rounded-2xl border bg-card">
      <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary font-display text-lg font-semibold">{c.name[0]}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold">{c.name}</h3>
            <Pill value={c.status} label={c.status === "verified" ? "verified" : c.status === "configured" ? "token issued, not yet seen" : "not set up"} />
            <span className="font-mono text-[11px] text-muted-foreground">{c.category}</span>
          </div>
          <p className="text-sm text-muted-foreground">{c.description}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 font-mono text-[11px] text-muted-foreground">
            {c.tokenPrefix && <span>token {c.tokenPrefix}…</span>}
            {c.expiresAt && <span className={cn(expired && "text-destructive")}>{expired ? "expired" : "expires"} {ago(c.expiresAt)}</span>}
            {c.status === "verified" && <span>last call {ago(c.lastSeen)}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btn.ghost} onClick={() => setOpen((o) => !o)} data-testid={`button-setup-${c.id}`}>
            Setup <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
          <button
            className={btn.primary}
            disabled={issue.isPending}
            data-testid={`button-issue-${c.id}`}
            onClick={() =>
              guard("Issuing tokens needs your own workspace.", () =>
                issue.mutate(
                  { id: c.id },
                  {
                    onSuccess: (t) => { setToken(t); result("Token issued").onSuccess(undefined); },
                    onError: (e) => toast({ title: "Couldn't issue token", description: errMessage(e), variant: "destructive" }),
                  },
                ),
              )
            }
          >
            <KeyRound className="h-4 w-4" /> {c.tokenPrefix ? "Replace token" : "Create token"}
          </button>
          {c.tokenPrefix && (
            <Confirm
              trigger={<button className={btn.danger} data-testid={`button-revoke-${c.id}`}>Revoke</button>}
              title={`Revoke ${c.name}'s token?`}
              body={`${c.name} will immediately lose access to Relay until you create a new token.`}
              confirmLabel="Revoke token"
              onConfirm={() => guard("Revoking tokens needs your own workspace.", () => revoke.mutate({ id: c.id }, result("Token revoked")))}
            />
          )}
        </div>
      </div>
      {open && (
        <div className="space-y-4 border-t bg-secondary/30 p-5 text-sm">
          {caution && (
            <div className="flex gap-2 rounded-lg border border-[hsl(42_85%_50%/.4)] bg-[hsl(42_85%_50%/.1)] p-3 text-[13px]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(32_80%_35%)]" /> {caution}
            </div>
          )}
          {c.instructions && <div className="whitespace-pre-line leading-relaxed">{c.instructions}</div>}
          <div>
            <div className="mb-1.5 flex items-center justify-between"><span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Native HTTP + bearer</span><CopyButton text={nativeSnippet} /></div>
            <pre className="overflow-x-auto rounded-lg border bg-background p-3 font-mono text-xs text-foreground">{nativeSnippet}</pre>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between"><span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Local bridge (mcp-remote) if headers aren't supported</span><CopyButton text={bridgeSnippet} /></div>
            <pre className="overflow-x-auto rounded-lg border bg-background p-3 font-mono text-xs text-foreground">{bridgeSnippet}</pre>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between"><span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">REST check</span><CopyButton text={restSnippet} /></div>
            <pre className="overflow-x-auto rounded-lg border bg-background p-3 font-mono text-xs text-foreground">{restSnippet}</pre>
          </div>
          <p className="text-xs text-muted-foreground">Status turns verified only after {c.name} actually calls Relay with its token.</p>
        </div>
      )}
      <TokenDialog token={token} name={c.name} onClose={() => setToken(null)} />
    </article>
  );
}

export default function ConnectionsPage() {
  usePageTitle("AI tools", "Connect your AI tools to Relay so they read and update the same plan.");
  const { state, isLoading, error, refetch } = useWorkspace();
  const health = useHealthCheck({ query: { queryKey: ["/api/healthz"], refetchInterval: 60000 } });
  const verified = state?.connections.filter((c) => c.status === "verified").length ?? 0;
  return (
    <AppShell>
      <PageHeader eyebrow="Behind the scenes" title="AI tools" lede="Give each tool its own token so it can read your plans and save checkpoints. Tokens last 90 days and are shown once.">
        <a href="/api/hub/skill" download className={btn.ghost} data-testid="link-download-skill"><Download className="h-4 w-4" /> Agent skill</a>
        <a href="/api/hub/docs" target="_blank" rel="noreferrer" className={btn.ghost} data-testid="link-api-docs"><BookOpen className="h-4 w-4" /> API docs</a>
      </PageHeader>
      <div className="rise mb-6 grid gap-3 rounded-2xl border bg-card p-4 text-sm md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">MCP endpoint · Streamable HTTP
            <span data-testid="status-health" className={cn("h-2 w-2 rounded-full", health.data?.status === "ok" ? "bg-accent" : health.isError ? "bg-destructive" : "bg-muted-foreground/40")} title={health.isError ? "Service unreachable" : "Service status"} />
          </div>
          <div className="mt-1 break-all font-mono text-[13px]" data-testid="text-mcp-url">{mcpUrl}</div>
          {isDev && <div className="mt-1.5 text-xs text-[hsl(32_80%_35%)]">Development URL. It changes and sleeps; publish Relay to get a stable address before connecting tools for real.</div>}
        </div>
        <CopyButton text={mcpUrl} label="Copy URL" testId="button-copy-mcp" />
      </div>
      {isLoading ? <LoadingBlock /> : error || !state ? <ErrorBlock error={error} onRetry={refetch} /> : (
        <>
          <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><Plug className="h-4 w-4" />{verified} of {state.connections.length} tools verified</div>
          <div className="space-y-3">{state.connections.map((c) => <ConnectionCard key={c.id} c={c} />)}</div>
        </>
      )}
    </AppShell>
  );
}
