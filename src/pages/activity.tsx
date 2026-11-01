import { useMemo, useState } from "react";
import { ExternalLink, History, Search } from "lucide-react";
import { AppShell } from "@/components/shell";
import { Dot, Empty, ErrorBlock, LoadingBlock, PageHeader, ago, field } from "@/components/kit";
import { usePageTitle, useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export default function ActivityPage() {
  usePageTitle("Activity log");
  const { state, isLoading, error, refetch } = useWorkspace();
  const [q, setQ] = useState("");
  const [src, setSrc] = useState("all");
  const sources = useMemo(() => Array.from(new Set((state?.activity ?? []).map((a) => a.source))).sort(), [state]);
  const pmap = new Map((state?.projects ?? []).map((p) => [p.id, p]));
  const list = (state?.activity ?? [])
    .filter((a) => src === "all" || a.source === src)
    .filter((a) => !q || `${a.title} ${a.description} ${a.kind}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <AppShell>
      <PageHeader eyebrow="Behind the scenes" title="Activity log" lede="A plain record of every change: what happened, which tool did it, and when." />
      {isLoading ? <LoadingBlock /> : error || !state ? <ErrorBlock error={error} onRetry={refetch} /> : (
        <>
          <div className="mb-4 flex flex-col gap-2 md:flex-row">
            <div className="relative md:w-72">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input data-testid="input-search-activity" className={cn(field, "pl-9")} placeholder="Search the log" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select data-testid="select-source" className={cn(field, "md:w-48")} value={src} onChange={(e) => setSrc(e.target.value)}>
              <option value="all">All sources</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {!list.length ? (
            <div className="rounded-2xl border bg-card"><Empty icon={<History className="h-5 w-5" />} title="Nothing logged" body="Changes from you and your AI tools show up here as they happen." /></div>
          ) : (
            <ol className="divide-y rounded-2xl border bg-card">
              {list.map((a) => {
                const p = pmap.get(a.projectId);
                return (
                  <li key={a.id} data-testid={`row-activity-${a.id}`} className="grid gap-1 px-5 py-3 md:grid-cols-[150px_1fr_auto] md:gap-4">
                    <div className="font-mono text-[11px] text-muted-foreground">{ago(a.createdAt)}</div>
                    <div className="min-w-0">
                      <div className="text-sm"><span className="font-medium">{a.source}</span> <span className="text-muted-foreground">· {a.kind.replace(/_/g, " ")}</span></div>
                      <div className="text-sm">{a.title}</div>
                      {a.description && <div className="line-clamp-2 text-xs text-muted-foreground">{a.description}</div>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {p && <span className="inline-flex items-center gap-1.5"><Dot color={p.color} className="h-2 w-2" />{p.title}</span>}
                      {a.url && <a href={a.url} target="_blank" rel="noreferrer" aria-label="Open link" data-testid={`link-activity-${a.id}`}><ExternalLink className="h-3.5 w-3.5" /></a>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </AppShell>
  );
}
