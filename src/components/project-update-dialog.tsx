import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Sparkles, Square, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { saveReviewedUpdateFn } from "@/lib/hub/hub.functions";
import { reviewedUpdateSchema, updateDraftSchema, UPDATE_INPUT_LIMIT, type UpdateDraft } from "@/lib/hub/update-draft";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, field } from "@/components/kit";
import { ModelBadge } from "@/components/model-badge";
import { UPDATE_MODEL_LABEL } from "@/lib/ai/model";

export function ProjectUpdateDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (open: boolean) => void; projectId: string }) {
  const [update, setUpdate] = useState("");
  const [draft, setDraft] = useState<UpdateDraft | null>(null);
  const [includeHandoff, setIncludeHandoff] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const save = useServerFn(saveReviewedUpdateFn);
  const qc = useQueryClient();
  useEffect(() => () => abort.current?.abort(), []);
  const generate = async () => {
    setError(""); setBusy(true); setDraft(null); setIncludeHandoff(true);
    const controller = new AbortController(); abort.current = controller;
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in to draft a project update.");
      const response = await fetch("/api/project-update", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ projectId, update }) });
      if (!response.ok) { const e = await response.json(); throw new Error(e.message); }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("The AI response was empty.");
      const decoder = new TextDecoder(); let buffer = ""; let gotDraft = false;
      while (true) {
        const chunk = await reader.read();
        buffer += decoder.decode(chunk.value, { stream: !chunk.done });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "draft") { setDraft(updateDraftSchema.parse(event.draft)); gotDraft = true; }
        }
        if (chunk.done) break;
      }
      if (!gotDraft && !controller.signal.aborted) throw new Error("The AI did not return a draft. Your update has been kept.");
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not draft this update."); }
    finally { setBusy(false); abort.current = null; }
  };
  const saveDraft = async () => {
    if (!draft || saving) return;
    const payload = reviewedUpdateSchema.safeParse({ projectId, tasks: draft.tasks, handoff: includeHandoff ? draft.handoff : null, reviewed: true });
    if (!payload.success) { setError(payload.error.issues[0]?.message ?? "Check the draft fields."); return; }
    setSaving(true); setError("");
    try {
      await save({ data: { data: payload.data } });
      await qc.invalidateQueries({ queryKey: ["hub", "state"] });
      setDraft(null); setUpdate(""); onOpenChange(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the draft."); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={o => { if (saving) return; if (!o) abort.current?.abort(); onOpenChange(o); }}>
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle className="font-display text-xl">Project update</DialogTitle><DialogDescription>{draft ? "Review tasks and handoff" : `Draft with ${UPDATE_MODEL_LABEL}`}</DialogDescription></DialogHeader>
      <Field label="Your update"><textarea aria-label="Your update" className={field} rows={5} maxLength={UPDATE_INPUT_LIMIT} value={update} disabled={busy || saving} onChange={e => setUpdate(e.target.value)} placeholder="Finished the sign-in page. Password reset still needs testing. Next session, check the confirmation email flow." /><div className="mt-1 text-right text-xs text-muted-foreground">{update.length.toLocaleString()} / {UPDATE_INPUT_LIMIT.toLocaleString()}</div></Field>
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs text-muted-foreground"><ModelBadge label={UPDATE_MODEL_LABEL} />{update.length.toLocaleString()} / {UPDATE_INPUT_LIMIT.toLocaleString()} · Uses workspace AI credits</span>{busy ? <Button variant="outline" onClick={() => abort.current?.abort()}><Square /> Stop</Button> : <Button variant="secondary" disabled={!update.trim() || saving} onClick={generate}><Sparkles />{draft ? "Draft again" : "Draft tasks & handoff"}</Button>}</div>
      {busy && <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> {UPDATE_MODEL_LABEL} is drafting…</div>}
      {error && <p role="alert" className="whitespace-pre-wrap break-words text-sm text-destructive">{error}</p>}
      {draft && <div className="space-y-5">
        <h3 className="font-display text-lg">Tasks ({draft.tasks.length})</h3>
        {draft.tasks.map((t, i) => <div key={i} className="space-y-2 border-b pb-4">
          <div className="flex items-center gap-2"><input aria-label={`Task ${i + 1} title`} className={field} maxLength={200} value={t.title} onChange={e => setDraft({ ...draft, tasks: draft.tasks.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} disabled={saving} /><Button variant="ghost" size="icon" title="Remove task" aria-label={`Remove task ${i + 1}`} disabled={saving} onClick={() => setDraft({ ...draft, tasks: draft.tasks.filter((_, j) => j !== i) })}><Trash2 /></Button></div>
          <textarea aria-label={`Task ${i + 1} description`} className={field} rows={2} maxLength={10000} value={t.description} disabled={saving} onChange={e => setDraft({ ...draft, tasks: draft.tasks.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })} />
          <select aria-label={`Task ${i + 1} priority`} className={field} value={t.priority} disabled={saving} onChange={e => setDraft({ ...draft, tasks: draft.tasks.map((x, j) => j === i ? { ...x, priority: e.target.value as typeof t.priority } : x) })}><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select>
        </div>)}
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={includeHandoff} disabled={saving} onChange={e => setIncludeHandoff(e.target.checked)} />Include handoff note</label>
        {includeHandoff && <div className="space-y-3">{([['title', 'Handoff title', 200], ['summary', 'Handoff summary', 15000], ['nextAction', 'Next action', 10000], ['target', 'Continue in', 100]] as const).map(([key, label, max]) => <Field key={key} label={label}><textarea aria-label={label} className={field} rows={key === 'summary' ? 4 : 2} maxLength={max} value={draft.handoff[key]} disabled={saving} onChange={e => setDraft({ ...draft, handoff: { ...draft.handoff, [key]: e.target.value } })} /></Field>)}</div>}
        <div className="flex justify-end"><Button disabled={saving || (!draft.tasks.length && !includeHandoff)} onClick={saveDraft}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Save reviewed update</Button></div>
      </div>}
    </DialogContent>
  </Dialog>;
}