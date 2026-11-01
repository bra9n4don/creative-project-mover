import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { Check, ShieldCheck, X } from "lucide-react";
import { useDecideApproval, type Approval } from "@/lib/hub-api";
import { AppShell } from "@/components/shell";
import { Confirm, Empty, ErrorBlock, LoadingBlock, PageHeader, Pill, ago } from "@/components/kit";
import { useHubResult, usePageTitle, useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

function Changes({ raw }: { raw: string }) {
  let parsed: unknown = null;
  try { parsed = JSON.parse(raw); } catch { /* show raw */ }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return (
      <dl className="divide-y rounded-lg border bg-background/60 font-mono text-xs">
        {Object.entries(parsed as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="whitespace-pre-wrap break-words">{typeof v === "string" ? v : JSON.stringify(v, null, 2)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return <pre className="overflow-x-auto rounded-lg border bg-background/60 p-3 font-mono text-xs">{parsed ? JSON.stringify(parsed, null, 2) : raw}</pre>;
}

export default function ApprovalsPage() {
  usePageTitle("Approvals");
  const { state, isLoading, error, refetch, guard } = useWorkspace();
  const decide = useDecideApproval();
  const result = useHubResult();
  const [show, setShow] = useState<"pending" | "decided">("pending");
  const all = state?.approvals ?? [];
  const list = all.filter((a) => (show === "pending" ? a.status === "pending" : a.status !== "pending"));
  const act = (a: Approval, d: "approved" | "rejected") =>
    guard("Approving changes needs your own workspace, in this browser.", () => decide.mutate({ id: a.id, data: { decision: d } }, result(d === "approved" ? "Change applied" : "Change rejected")));

  return (
    <AppShell>
      <PageHeader eyebrow="Behind the scenes" title="Approvals" lede="When an AI tool wants to make a sensitive change to a plan, it waits here. You see the exact change before anything happens." />
      {isLoading ? <LoadingBlock /> : error || !state ? <ErrorBlock error={error} onRetry={refetch} /> : (
        <>
          <div className="mb-4 flex gap-1">
            {(["pending", "decided"] as const).map((s) => (
              <button key={s} data-testid={`tab-${s}`} onClick={() => setShow(s)} className={cn("rounded-full px-3 py-1.5 text-xs font-medium capitalize", show === s ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary")}>
                {s} {s === "pending" && <span className="opacity-60">{all.filter((a) => a.status === "pending").length}</span>}
              </button>
            ))}
          </div>
          {!list.length ? (
            <div className="rounded-2xl border bg-card"><Empty icon={<ShieldCheck className="h-5 w-5" />} title={show === "pending" ? "Nothing waiting on you" : "No decisions yet"} body="AI tools only propose changes here; nothing is applied without your click." /></div>
          ) : (
            <div className="space-y-3">
              {list.map((a) => (
                <article key={a.id} data-testid={`card-approval-${a.id}`} className="rise rounded-2xl border bg-card p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Pill value={a.status} />
                    <span>from <span className="font-medium text-foreground">{a.source}</span></span>
                    <span>· {ago(a.createdAt)}</span>
                    {a.projectId && <Link href={`/projects/${a.projectId}`} className="ml-auto font-medium text-primary hover:underline">{a.projectTitle}</Link>}
                  </div>
                  <h3 className="mt-2 font-display text-lg font-semibold">{a.title}</h3>
                  {a.description && <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>}
                  <div className="mt-3"><Changes raw={a.changes} /></div>
                  {a.status === "pending" && (
                    <div className="mt-4 flex gap-2">
                      <Confirm destructive={false} trigger={<button className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground" data-testid={`button-approve-${a.id}`}><Check className="h-4 w-4" />Approve</button>}
                        title="Apply this exact change?" body={`The change above will be applied to ${a.projectTitle || "this project"} as shown.`} confirmLabel="Approve and apply" onConfirm={() => act(a, "approved")} />
                      <Confirm trigger={<button className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium" data-testid={`button-reject-${a.id}`}><X className="h-4 w-4" />Reject</button>}
                        title="Reject this change?" body="Nothing will be applied. The AI tool will see it was rejected." confirmLabel="Reject" onConfirm={() => act(a, "rejected")} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
