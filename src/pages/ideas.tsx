import { useMemo, useState } from "react";
import { Archive, ArrowUpRight, Lightbulb, Pencil, Trash2 } from "lucide-react";
import { useCreateIdea, useUpdateIdea, useDeleteIdea, usePromoteIdea, type Idea } from "@workspace/api-client-react";
import { AppShell } from "@/components/shell";
import { Confirm, Empty, ErrorBlock, Field, LoadingBlock, PageHeader, Pill, ago, btn, field } from "@/components/kit";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useHubResult, usePageTitle, useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

const tabs = ["inbox", "exploring", "promoted", "archived"] as const;
const parseTags = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12);

function EditIdea({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const update = useUpdateIdea();
  const result = useHubResult();
  const [f, setF] = useState({ title: "", description: "", tags: "" });
  const [seen, setSeen] = useState("");
  if (idea && seen !== idea.id) {
    setSeen(idea.id);
    setF({ title: idea.title, description: idea.description, tags: idea.tags.join(", ") });
  }
  return (
    <Dialog open={!!idea} onOpenChange={(o) => { if (!o) { setSeen(""); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display text-xl">Edit idea</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Field label="Idea"><input data-testid="input-edit-idea-title" className={field} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Notes"><textarea data-testid="input-edit-idea-description" className={field} rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Tags" hint="Comma separated"><input data-testid="input-edit-idea-tags" className={field} value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <button className={btn.ghost} onClick={onClose}>Cancel</button>
            <button className={btn.primary} disabled={!f.title.trim() || update.isPending} data-testid="button-save-idea"
              onClick={() => idea && update.mutate({ id: idea.id, data: { title: f.title.trim(), description: f.description, tags: parseTags(f.tags) } }, result("Idea saved", () => { setSeen(""); onClose(); }))}>
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function IdeasPage() {
  usePageTitle("Ideas", "Catch ideas before they vanish. Promote the good ones into projects.");
  const { state, isLoading, error, refetch, guard } = useWorkspace();
  const [tab, setTab] = useState<(typeof tabs)[number]>("inbox");
  const [cap, setCap] = useState({ title: "", description: "", tags: "" });
  const [editing, setEditing] = useState<Idea | null>(null);
  const create = useCreateIdea();
  const update = useUpdateIdea();
  const del = useDeleteIdea();
  const promote = usePromoteIdea();
  const result = useHubResult();
  const list = useMemo(() => (state?.ideas ?? []).filter((i) => i.status === tab).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [state, tab]);
  const w = (fn: () => void) => guard("Saving ideas needs your own workspace.", fn);

  const capture = () => {
    if (!cap.title.trim()) return;
    w(() => create.mutate({ data: { title: cap.title.trim(), description: cap.description, tags: parseTags(cap.tags) } }, result("Captured", () => setCap({ title: "", description: "", tags: "" }))));
  };

  return (
    <AppShell>
      <PageHeader eyebrow="Ideas" title="Catch it, then get back to work" lede="Half-thoughts from any AI tool land here. Nothing gets lost; nothing has to be decided now." />
      <form className="rise mb-8 rounded-2xl border-2 border-dashed border-primary/30 bg-card p-4" onSubmit={(e) => { e.preventDefault(); capture(); }}>
        <input data-testid="input-capture-title" className="w-full bg-transparent font-display text-xl outline-none placeholder:text-muted-foreground/60" placeholder="What just occurred to you?" value={cap.title} maxLength={150} onChange={(e) => setCap({ ...cap, title: e.target.value })} />
        {cap.title && (
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_200px_auto]">
            <input data-testid="input-capture-description" className={field} placeholder="Any detail (optional)" value={cap.description} onChange={(e) => setCap({ ...cap, description: e.target.value })} />
            <input data-testid="input-capture-tags" className={field} placeholder="tags, comma, separated" value={cap.tags} onChange={(e) => setCap({ ...cap, tags: e.target.value })} />
            <button type="submit" className={btn.primary} disabled={create.isPending} data-testid="button-capture">Capture</button>
          </div>
        )}
      </form>
      {isLoading ? <LoadingBlock /> : error || !state ? <ErrorBlock error={error} onRetry={refetch} /> : (
        <>
          <div className="mb-4 flex gap-1 overflow-x-auto border-b">
            {tabs.map((t) => (
              <button key={t} data-testid={`tab-${t}`} onClick={() => setTab(t)} className={cn("-mb-px border-b-2 px-3 py-2 text-sm capitalize", tab === t ? "border-primary font-medium" : "border-transparent text-muted-foreground")}>
                {t} <span className="font-mono text-xs opacity-60">{state.ideas.filter((i) => i.status === t).length}</span>
              </button>
            ))}
          </div>
          {!list.length ? (
            <Empty icon={<Lightbulb className="h-5 w-5" />} title={tab === "inbox" ? "Inbox zero" : `Nothing ${tab}`} body={tab === "inbox" ? "Type above to catch the next one. Your AI tools can drop ideas here too." : "Ideas move here as you sort them."} />
          ) : (
            <div className="columns-1 gap-3 md:columns-2 xl:columns-3">
              {list.map((i) => (
                <div key={i.id} data-testid={`card-idea-${i.id}`} className="rise mb-3 break-inside-avoid rounded-2xl border bg-card p-4">
                  <div className="flex items-start gap-2">
                    <h3 className="flex-1 font-medium leading-snug">{i.title}</h3>
                    <Pill value={i.status} />
                  </div>
                  {i.description && <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">{i.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-1">{i.tags.map((t) => <span key={t} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10.5px]">#{t}</span>)}</div>
                  <div className="mt-3 text-xs text-muted-foreground">{i.source || "Captured here"} · {ago(i.createdAt)}</div>
                  {i.status !== "promoted" && (
                    <div className="mt-3 flex flex-wrap items-center gap-1 border-t pt-3">
                      <Confirm
                        destructive={false}
                        trigger={<button className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground" data-testid={`button-promote-${i.id}`}><ArrowUpRight className="h-3.5 w-3.5" />Make it a project</button>}
                        title="Promote to a project?"
                        body={`"${i.title}" becomes a new project in planning. The idea stays here marked promoted.`}
                        confirmLabel="Promote"
                        onConfirm={() => w(() => promote.mutate({ id: i.id }, result("Promoted to project")))}
                      />
                      {i.status === "inbox" && <button className="rounded-md px-2 py-1 text-xs hover:bg-secondary" data-testid={`button-explore-${i.id}`} onClick={() => w(() => update.mutate({ id: i.id, data: { status: "exploring" } }, result("Moved to exploring")))}>Explore</button>}
                      {i.status === "archived" ? (
                        <button className="rounded-md px-2 py-1 text-xs hover:bg-secondary" data-testid={`button-restore-${i.id}`} onClick={() => w(() => update.mutate({ id: i.id, data: { status: "inbox" } }, result("Back in inbox")))}>Restore</button>
                      ) : (
                        <button className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Archive" data-testid={`button-archive-${i.id}`} onClick={() => w(() => update.mutate({ id: i.id, data: { status: "archived" } }, result("Archived")))}><Archive className="h-3.5 w-3.5" /></button>
                      )}
                      <button className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Edit" data-testid={`button-edit-idea-${i.id}`} onClick={() => w(() => setEditing(i))}><Pencil className="h-3.5 w-3.5" /></button>
                      <Confirm
                        trigger={<button className="rounded-md p-1.5 text-muted-foreground hover:text-destructive" aria-label="Delete" data-testid={`button-delete-idea-${i.id}`}><Trash2 className="h-3.5 w-3.5" /></button>}
                        title="Delete this idea?" body="Archive keeps it out of sight; delete removes it for good." confirmLabel="Delete idea"
                        onConfirm={() => w(() => del.mutate({ id: i.id }, result("Idea deleted")))}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <EditIdea idea={editing} onClose={() => setEditing(null)} />
    </AppShell>
  );
}
