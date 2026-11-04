import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/shell";
import { Empty, ErrorBlock, LoadingBlock, PageHeader, ago } from "@/components/kit";
import { usePageTitle, useWorkspace } from "@/lib/workspace";
import { assistantUsage } from "@/lib/hub/usage";

export default function UsagePage() {
  usePageTitle("Assistant usage", "How many checkpoints and tasks each connected assistant saves.");
  const { state, isLoading, error, refetch } = useWorkspace();
  const rows = useMemo(() => (state ? assistantUsage(state) : []), [state]);
  const max = Math.max(1, ...rows.map(r => r.total));
  return (
    <AppShell>
      <PageHeader eyebrow="Behind the scenes" title="Assistant usage" lede="See which connected assistants are actually saving checkpoints, tasks and ideas. Your own saves aren't counted." />
      {isLoading ? <LoadingBlock /> : error || !state ? <ErrorBlock error={error} onRetry={refetch} /> : !rows.length ? (
        <Empty icon={BarChart3} title="No assistant saves yet" body="Connect ChatGPT or Claude from the Connect assistant page and ask it to save a checkpoint." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm" data-testid="table-usage">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-3">Assistant</th><th className="p-3 text-right">Checkpoints</th><th className="p-3 text-right">Tasks</th><th className="p-3 text-right">Ideas</th><th className="p-3">Share</th><th className="p-3">Last active</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.source} className="border-b last:border-0">
                  <td className="p-3 font-medium">{r.source}</td>
                  <td className="p-3 text-right tabular-nums">{r.checkpoints}</td>
                  <td className="p-3 text-right tabular-nums">{r.tasks}</td>
                  <td className="p-3 text-right tabular-nums">{r.ideas}</td>
                  <td className="p-3 w-40"><div className="h-2 rounded-full bg-muted" aria-label={`${r.total} saves`}><div className="h-2 rounded-full bg-primary" style={{ width: `${(r.total / max) * 100}%` }} /></div></td>
                  <td className="p-3 text-muted-foreground">{r.lastActive ? ago(r.lastActive) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-3 text-xs text-muted-foreground">Saves made before assistants were named show as "Connected assistant".</p>
        </div>
      )}
    </AppShell>
  );
}
