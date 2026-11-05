import { useEffect, useRef, useState } from "react";
import { Loader2, Save, Sparkles, Square, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { IDEA_INPUT_LIMIT, ideaDraftSchema, reviewedIdeaDraftSchema, type IdeaDraft } from "@/lib/hub/idea-draft";
import { useUpdateIdea, type Idea } from "@/lib/hub-api";
import { useHubResult } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, field } from "@/components/kit";
import { ModelBadge } from "@/components/model-badge";
import { UPDATE_MODEL_LABEL } from "@/lib/ai/model";

function buildDescription(idea: Idea, draft: IdeaDraft): string {
  const parts = [idea.description.trim(), draft.summary.trim()];
  if (draft.tasks.length) parts.push("First tasks:\n" + draft.tasks.map(t => `- ${t.title}${t.description ? ` — ${t.description}` : ""}`).join("\n"));
  if (draft.risks.length) parts.push("Risks:\n" + draft.risks.map(r => `- ${r}`).join("\n"));
  if (draft.openQuestions.length) parts.push("Open questions:\n" + draft.openQuestions.map(q => `- ${q}`).join("\n"));
  return parts.filter(Boolean).join("\n\n").slice(0, 10000);
}

export function IdeaFleshDialog({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<IdeaDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const update = useUpdateIdea();
  const result = useHubResult();
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { setNotes(""); setDraft(null); setError(""); }, [idea?.id]);

  const generate = async () => {
    if (!idea) return;
    setError(""); setBusy(true); setDraft(null);
    const controller = new AbortController(); abort.current = controller;
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in to flesh out an idea.");
      const response = await fetch("/api/idea-flesh", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ ideaId: idea.id, notes: notes.trim() || undefined }) });
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
          if (event.type === "draft") { setDraft(ideaDraftSchema.parse(event.draft)); gotDraft = true; }
        }
        if (chunk.done) break;
      }
      if (!gotDraft && !controller.signal.aborted) throw new Error("The AI did not return a draft. Your idea has been kept.");
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not flesh out this idea."); }
    finally { setBusy(false); abort.current = null; }
  };

  const saveDraft = () => {
    if (!idea || !draft) return;
    const validated = reviewedIdeaDraftSchema.safeParse(draft);
    if (!validated.success) { setError(validated.error.issues[0]?.message ?? "Check the draft fields."); return; }
    update.mutate({ id: idea.id, data: { description: buildDescription(idea, validated.data), status: idea.status === "inbox" ? "exploring" : idea.status } }, result("Idea fleshed out", () => { setDraft(null); setNotes(""); onClose(); }));
  };

  const saving = update.isPending;
  return <Dialog open={!!idea} onOpenChange={o => { if (saving) return; if (!o) { abort.current?.abort(); onClose(); } }}>
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle className="font-display text-xl">Flesh out idea</DialogTitle><DialogDescription>{draft ? "Review the draft, then save it onto the idea" : `Draft with ${UPDATE_MODEL_LABEL}`}</DialogDescription></DialogHeader>
      {idea && <p className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium">{idea.title}</p>}
      <Field label="Extra notes" hint="Optional context the AI should consider"><textarea aria-label="Extra notes" className={field} rows={3} maxLength={IDEA_INPUT_LIMIT} value={notes} disabled={busy || saving} onChange={e => setNotes(e.target.value)} placeholder="Thinking of a small weekend project, keep it cheap to run…" /></Field>
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs text-muted-foreground"><ModelBadge label={UPDATE_MODEL_LABEL} />Uses workspace AI credits</span>{busy ? <Button variant="outline" onClick={() => abort.current?.abort()}><Square /> Stop</Button> : <Button variant="secondary" disabled={saving} onClick={generate}><Sparkles />{draft ? "Draft again" : "Flesh out"}</Button>}</div>
      {busy && <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> {UPDATE_MODEL_LABEL} is drafting…</div>}
      {error && <p role="alert" className="whitespace-pre-wrap break-words text-sm text-destructive">{error}</p>}
      {draft && <div className="space-y-5">
        <Field label="Summary"><textarea aria-label="Summary" className={field} rows={4} maxLength={2000} value={draft.summary} disabled={saving} onChange={e => setDraft({ ...draft, summary: e.target.value })} /></Field>
        {draft.tasks.length > 0 && <div className="space-y-2">
          <h3 className="font-display text-lg">First tasks ({draft.tasks.length})</h3>
          {draft.tasks.map((t, i) => <div key={i} className="flex items-start gap-2 border-b pb-3">
            <div className="flex-1 space-y-2">
              <input aria-label={`Task ${i + 1} title`} className={field} maxLength={200} value={t.title} disabled={saving} onChange={e => setDraft({ ...draft, tasks: draft.tasks.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} />
              <textarea aria-label={`Task ${i + 1} description`} className={field} rows={2} maxLength={600} value={t.description} disabled={saving} onChange={e => setDraft({ ...draft, tasks: draft.tasks.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })} />
            </div>
            <Button variant="ghost" size="icon" title="Remove task" aria-label={`Remove task ${i + 1}`} disabled={saving} onClick={() => setDraft({ ...draft, tasks: draft.tasks.filter((_, j) => j !== i) })}><Trash2 /></Button>
          </div>)}
        </div>}
        {draft.risks.length > 0 && <Field label="Risks"><textarea aria-label="Risks" className={field} rows={3} value={draft.risks.join("\n")} disabled={saving} onChange={e => setDraft({ ...draft, risks: e.target.value.split("\n").map(r => r.trim()).filter(Boolean).slice(0, 5) })} /></Field>}
        {draft.openQuestions.length > 0 && <Field label="Open questions"><textarea aria-label="Open questions" className={field} rows={3} value={draft.openQuestions.join("\n")} disabled={saving} onChange={e => setDraft({ ...draft, openQuestions: e.target.value.split("\n").map(q => q.trim()).filter(Boolean).slice(0, 5) })} /></Field>}
        <div className="flex justify-end"><Button disabled={saving} onClick={saveDraft}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Save onto idea</Button></div>
      </div>}
    </DialogContent>
  </Dialog>;
}
