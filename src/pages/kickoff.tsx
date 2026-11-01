import { useEffect, useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useAuth } from "@/lib/auth";
import { useWorkspace, errMessage } from "@/lib/workspace";
import { supabase } from "@/integrations/supabase/client";
import { useKickoffSaving } from "@/lib/use-kickoff-saving";
import { briefSchema, planSchema, checkpointCode, clarifyFields, kickoffMarkdown, kickoffSchema, kickoffSteps, newKickoff, restoreCheckpoint, stepIssue, syncBrainstorm, mindMapClusters, kickoffSizeIssue, type Kickoff } from "@/lib/kickoff";
import { KickoffMindMap, emptyMindMap } from "@/components/kickoff-mind-map";
import { AppShell } from "@/components/shell";
import { Field, field, ErrorBlock, LoadingBlock } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KickoffGuidance } from "@/components/kickoff-guidance";
import { ArrowLeft, ArrowRight, Check, Copy, Download, Loader2, Pause, Plus, Rocket, Sparkles, Square, Trash2, Upload } from "lucide-react";

const labels = { goal: "Goal", audience: "Audience", scope: "Scope", budget: "Budget", timeline: "Timeline", timeAvailable: "Time available", risks: "Risks", unknowns: "Unknowns" };
const briefLabels = { title: "Project title", goal: "Project goal", audience: "Who it is for", scope: "In scope", outOfScope: "Out of scope", success: "Success criteria", constraints: "Constraints", unknowns: "Open questions" };
const reviewLabels = { goal: "The goal and audience are clear", scope: "The scope fits my budget and available time", plan: "The milestones and tasks are actionable", risks: "I have noted the risks and my first three actions", ready: "I have reviewed this plan and am ready to start" };
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function KickoffBody() {
  const { state, isLoading, error: workspaceError, refetch } = useWorkspace();
  const [k, setK] = useState<Kickoff>(newKickoff);
  const storage = useKickoffSaving(k);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"text" | "map">("text");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [secured, setSecured] = useState(false);
  const [resume, setResume] = useState("");
  const [resumeOpen, setResumeOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkpointError, setCheckpointError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const upload = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const edit = (patch: Partial<Kickoff>) => { setK(prev => ({ ...prev, ...patch, review: patch.review ?? { goal: false, scope: false, plan: false, risks: false, ready: false } })); setError(""); setNotice(""); };
  const restore = (value: string) => {
    try {
      const restored = restoreCheckpoint(value);
      const existing = storage.saved.find(r => r.data.id === restored.id);
      if (existing?.completed) throw new Error("This Kickoff is complete. Open its project instead of restoring an earlier checkpoint.");
      storage.activate(existing); setK(restored); setPaused(false); setResumeOpen(false); setError("");
      setNotice(`Checkpoint restored at step ${restored.step + 1}: ${kickoffSteps[restored.step]}.`);
    }
    catch (e) { setError(errMessage(e)); }
  };
  /** Streams one draft from base and returns the updated kickoff (null if stopped/failed). */
  const draftOne = async (mode: "brief" | "plan", base: Kickoff, abort: AbortController): Promise<Kickoff | null> => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in again to draft your Kickoff.");
      const res = await fetch("/api/kickoff-draft", { method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ mode, kickoff: base }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      const reader = res.body?.getReader(); if (!reader) throw new Error("The AI response was empty.");
      const decoder = new TextDecoder(); let buffer = ""; let next: Kickoff | null = null;
      while (true) {
        const chunk = await reader.read(); buffer += decoder.decode(chunk.value, { stream: !chunk.done });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) {
          const event = JSON.parse(line);
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "draft") {
            const draft = mode === "brief" ? briefSchema.parse(event.draft) : planSchema.parse(event.draft);
            next = kickoffSchema.parse({ ...base, [mode]: draft });
            edit(next);
          }
        }
        if (chunk.done) break;
      }
      if (!next && !abort.signal.aborted) throw new Error("No draft was returned. Your answers have been kept.");
      return next;
  };
  /** AI Expand: drafts the brief from the mind map, then the plan from that brief. Both stay editable drafts for review. */
  const expand = async () => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    const abort = new AbortController(); controller.current = abort;
    try {
      const base = k.mindMap ? { ...k, brainstorm: syncBrainstorm(k.brainstorm, k.mindMap).slice(0, 10000) } : k;
      const withBrief = await draftOne("brief", base, abort);
      const withPlan = withBrief && !abort.signal.aborted ? await draftOne("plan", withBrief, abort) : null;
      if (withPlan) setNotice("Brief and plan drafted from your mind map. Review them in steps 3 and 4 before continuing.");
    } catch (e) { if (!abort.signal.aborted) setError(errMessage(e)); }
    finally { if (abort.signal.aborted) setNotice("Drafting stopped. Anything already drafted is kept for review."); setBusy(false); controller.current = null; }
  };
  const generate = async (mode: "brief" | "plan") => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    const abort = new AbortController(); controller.current = abort;
    try { if (await draftOne(mode, k, abort)) setNotice("Draft ready for your review."); }
    catch (e) { if (!abort.signal.aborted) setError(errMessage(e)); else setNotice("Drafting stopped. Your previous draft is unchanged."); }
    finally { setBusy(false); controller.current = null; }
  };
  const exportToRelay = async () => {
    if (saving) return;
    setSaving(true); setError("");
    try {
      const result = await storage.persist(k, 5);
      if (!result) throw new Error("Your project could not be saved. Try again.");
      setK(prev => ({ ...prev, exportedProjectId: result.projectId }));
      setNotice("Kickoff complete. Your project, reviewed tasks and handoffs are saved.");
    } catch (e) { setError(errMessage(e)); }
    finally { setSaving(false); }
  };
  const continueStep = async () => {
    const issue = stepIssue(k); if (issue) { setError(issue); return; }
    setSaving(true); setError("");
    try {
      await storage.persist({ ...k, step: k.step + 1 }, k.step);
      setK(prev => ({ ...prev, step: prev.step + 1 })); setNotice("");
    } catch (e) { setError(errMessage(e)); }
    finally { setSaving(false); }
  };
  const pause = async () => {
    setSaving(true); setError(""); setCheckpointError(""); setCopied(false); setSecured(false);
    try { const saved = await storage.flush(); setSecured(!!saved || !!storage.projectId); }
    catch { setCheckpointError("Your project could not be saved. Download the checkpoint or copy its code before pausing."); }
    finally { setSaving(false); }
    setPauseOpen(true);
  };
  if (isLoading) return <LoadingBlock />;
  if (workspaceError || !state) return <ErrorBlock error={workspaceError} onRetry={refetch} />;
  const locked = busy || saving || !!k.exportedProjectId;
  const textInput = (label: string, value: string, change: (v: string) => void, max = 10000, rows = 3) => <Field label={label}><textarea aria-label={label} className={field} maxLength={max} rows={rows} value={value} disabled={locked} onChange={e => change(e.target.value)} /></Field>;
  const aiButton = (mode: "brief" | "plan") => <div className="flex flex-wrap items-center gap-3">{busy ? <Button variant="outline" onClick={() => controller.current?.abort()}><Square /> Stop drafting</Button> : <Button variant="secondary" disabled={locked || !k.brainstorm.trim()} onClick={() => generate(mode)}><Sparkles />{mode === "brief" ? "Draft brief with AI" : "Draft plan with AI"}</Button>}<span className="text-xs text-muted-foreground">Uses workspace AI credits · replaces the current {mode} draft</span></div>;
  return <>
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-sm text-primary"><Rocket className="h-4 w-4" /> New project</div><h1 className="font-display text-3xl font-semibold">Kickoff</h1><p className="mt-2 text-sm text-muted-foreground">From a rough idea to a plan you’re ready to start.</p></div><Button variant="outline" disabled={busy || saving} onClick={() => { setResumeOpen(true); setError(""); }}><Upload /> Resume checkpoint</Button></header>
    <nav aria-label="Kickoff steps" className="mb-8 grid grid-cols-2 gap-2 border-y py-4 md:grid-cols-3 xl:grid-cols-6">{kickoffSteps.map((name, i) => <div key={name} aria-current={k.step === i ? "step" : undefined} className={`flex items-start gap-2 text-sm ${k.step === i ? "font-semibold text-primary" : "text-muted-foreground"}`}><span className="mt-0.5 font-mono text-xs">{i < k.step ? <Check className="h-4 w-4" /> : `0${i + 1}`}</span><span>{name}</span></div>)}</nav>
    {error && <p role="alert" className="mb-4 break-words text-sm text-destructive">{error}</p>}
    {storage.saveError && <div role="alert" className="mb-4 text-sm text-destructive">{storage.saveError}<Button size="sm" variant="outline" onClick={() => { void storage.flush().catch(() => undefined); }}>Retry saving</Button></div>}
    <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span role="status">{storage.status}</span>{storage.projectId && <Link className="text-primary" href={`/projects/${storage.projectId}`}>Open saved project</Link>}</div>
    {!k.brainstorm && !storage.projectId && <section className="mb-6 border-b pb-5"><h2 className="mb-3 font-display text-xl">Saved Kickoffs</h2>{storage.loadingSaved ? <p>Loading saved projects…</p> : storage.listError ? <Button variant="outline" onClick={() => { void storage.reloadSaved(); }}>Retry loading saved projects</Button> : storage.saved.filter(r => !r.completed).length ? <div className="flex flex-wrap gap-2">{storage.saved.filter(r => !r.completed).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(r => <Button key={r.data.id} variant="outline" onClick={() => { storage.activate(r); setK(r.data); setPaused(false); }}><ArrowRight />{state.projects.find(p => p.id === r.projectId)?.title ?? "Saved project"} · Step {r.data.step + 1}</Button>)}</div> : <p className="text-sm text-muted-foreground">No unfinished Kickoffs.</p>}</section>}
    {notice && <p role="status" className="mb-4 text-sm text-accent">{notice}</p>}
    {busy && <p role="status" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Drafting {k.step === 0 ? "brief and plan" : k.step === 2 ? "brief" : "plan"}…</p>}
    {paused ? <section className="py-12"><h2 className="font-display text-2xl">Kickoff paused</h2><p className="my-4 text-muted-foreground">Your answers are saved in your project. Resume from Saved Kickoffs when you return.</p><Button onClick={() => setPaused(false)}><ArrowRight /> Continue this session</Button></section> : <>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_240px]"><section className="min-w-0 space-y-5"><div><p className="mb-1 font-mono text-xs text-muted-foreground">STEP {k.step + 1} OF 6</p><h2 className="font-display text-2xl font-semibold">{kickoffSteps[k.step]}</h2></div>
        {k.step === 0 && <>
          <Field label="Start from an idea"><select aria-label="Start from an idea" className={field} disabled={locked} value={k.sourceIdeaId ?? ""} onChange={e => { const idea = state.ideas.find(i => i.id === e.target.value); edit({ sourceIdeaId: idea?.id ?? null, brainstorm: idea ? `${idea.title}\n\n${idea.description}` : k.brainstorm }); }}><option value="">Freeform brainstorm</option>{state.ideas.filter(i => i.status !== "promoted" && i.status !== "archived").map(i => <option key={i.id} value={i.id}>{i.title}</option>)}</select></Field>
          <div role="tablist" aria-label="Brainstorm view" className="inline-flex rounded-lg border p-0.5">{(["text", "map"] as const).map(v => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 text-sm ${view === v ? "bg-secondary font-medium" : "text-muted-foreground"}`}>{v === "text" ? "Text" : "Mind map"}</button>)}</div>
          {view === "map"
            ? <KickoffMindMap disabled={locked} onExpand={expand} value={k.mindMap ?? emptyMindMap(k.brainstorm)} onChange={m => edit({ mindMap: m, brainstorm: syncBrainstorm(k.brainstorm, m).slice(0, 10000) })} />
            : textInput("Your ideas", k.brainstorm, v => edit({ brainstorm: v }), 10000, 8)}
          <div className="flex flex-wrap gap-2">{["What problem do I want to solve?", "Who would benefit?", "What is the smallest useful version?"].map(prompt => <Button key={prompt} size="sm" variant="ghost" disabled={locked} onClick={() => edit({ brainstorm: `${k.brainstorm}\n\n${prompt}\n`.trimStart() })}><Plus />{prompt}</Button>)}</div>
        </>}
        {k.step === 1 && <div className="grid gap-4 sm:grid-cols-2">{clarifyFields.map(key => <div key={key}>{textInput(labels[key], k.clarify[key], v => edit({ clarify: { ...k.clarify, [key]: v } }), 10000, 3)}<Button size="sm" variant="ghost" disabled={locked} onClick={() => edit({ clarify: { ...k.clarify, [key]: "not sure yet" } })}>Not sure yet</Button></div>)}</div>}
        {k.step === 2 && <>{aiButton("brief")}{(Object.keys(briefLabels) as (keyof typeof briefLabels)[]).map(key => <div key={key}>{textInput(briefLabels[key], k.brief[key], v => edit({ brief: { ...k.brief, [key]: v } }), key === "title" ? 150 : 10000, key === "title" ? 1 : 3)}</div>)}</>}
        {k.step === 3 && <>{aiButton("plan")}{k.mindMap && mindMapClusters(k.mindMap).length > 0 && <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={locked || k.plan.milestones.length >= 8} onClick={() => { const add = mindMapClusters(k.mindMap!).filter(c => !k.plan.milestones.some(m => m.title.trim().toLowerCase() === c.title.toLowerCase())); edit({ plan: { milestones: [...k.plan.milestones, ...add].slice(0, 8) } }); setNotice(add.length ? `Added ${Math.min(add.length, 8 - k.plan.milestones.length)} milestones from your mind map.` : "Every mind map cluster is already a milestone."); }}><Network /> Promote mind map clusters</Button><span className="text-xs text-muted-foreground">Each main branch becomes a milestone; its features and ideas become tasks</span></div>}{k.plan.milestones.map((m, i) => <div key={i} className="space-y-3 border-b pb-6"><div className="flex items-center justify-between"><h3 className="font-medium">Milestone {i + 1}</h3><Button variant="ghost" size="icon" title="Remove milestone" aria-label={`Remove milestone ${i + 1}`} disabled={locked} onClick={() => edit({ plan: { milestones: k.plan.milestones.filter((_, j) => i !== j) } })}><Trash2 /></Button></div>
          {textInput(`Milestone ${i + 1} title`, m.title, v => edit({ plan: { milestones: k.plan.milestones.map((x, j) => i === j ? { ...x, title: v } : x) } }), 200, 1)}
          {textInput(`Milestone ${i + 1} outcome`, m.outcome, v => edit({ plan: { milestones: k.plan.milestones.map((x, j) => i === j ? { ...x, outcome: v } : x) } }), 10000, 2)}
          {m.tasks.map((t, n) => <div key={n} className="space-y-2 border-l-2 pl-4"><div className="flex items-center gap-2"><input aria-label={`Milestone ${i + 1} task ${n + 1} title`} className={field} maxLength={200} disabled={locked} value={t.title} onChange={e => edit({ plan: { milestones: k.plan.milestones.map((x, j) => i === j ? { ...x, tasks: x.tasks.map((a, b) => b === n ? { ...a, title: e.target.value } : a) } : x) } })} /><Button size="icon" variant="ghost" title="Remove task" aria-label={`Remove milestone ${i + 1} task ${n + 1}`} disabled={locked} onClick={() => edit({ plan: { milestones: k.plan.milestones.map((x, j) => i === j ? { ...x, tasks: x.tasks.filter((_, b) => b !== n) } : x) } })}><Trash2 /></Button></div>
            {textInput(`Milestone ${i + 1} task ${n + 1} notes`, t.description, v => edit({ plan: { milestones: k.plan.milestones.map((x, j) => i === j ? { ...x, tasks: x.tasks.map((a, b) => b === n ? { ...a, description: v } : a) } : x) } }), 10000, 2)}
            <select aria-label={`Milestone ${i + 1} task ${n + 1} priority`} className={field} value={t.priority} disabled={locked} onChange={e => edit({ plan: { milestones: k.plan.milestones.map((x, j) => i === j ? { ...x, tasks: x.tasks.map((a, b) => b === n ? { ...a, priority: e.target.value as typeof t.priority } : a) } : x) } })}><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select>
          </div>)}
          <Button size="sm" variant="outline" disabled={locked || m.tasks.length >= 20} onClick={() => edit({ plan: { milestones: k.plan.milestones.map((x, j) => i === j ? { ...x, tasks: [...x.tasks, { title: "", description: "", priority: "medium" }] } : x) } })}><Plus /> Add task</Button>
        </div>)}<Button variant="outline" disabled={locked || k.plan.milestones.length >= 8} onClick={() => edit({ plan: { milestones: [...k.plan.milestones, { title: "", outcome: "", tasks: [{ title: "", description: "", priority: "medium" }] }] } })}><Plus /> Add milestone</Button></>}
        {k.step === 4 && <>{textInput("Top risks and how to reduce them", k.risks, v => edit({ risks: v }), 10000, 5)}{k.firstActions.map((a, i) => <div key={i}>{textInput(`First action ${i + 1} this week`, a, v => { const actions: Kickoff["firstActions"] = [...k.firstActions]; actions[i] = v; edit({ firstActions: actions }); }, 200, 2)}</div>)}</>}
        {k.step === 5 && <>
          <div className="border-y py-4"><h3 className="font-display text-xl">{k.brief.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm">{k.brief.goal}</p><p className="mt-3 text-sm text-muted-foreground">{k.plan.milestones.length} milestones · {k.plan.milestones.reduce((n, m) => n + m.tasks.length, 0)} planned tasks · 3 first actions</p></div>
          <details><summary className="cursor-pointer text-sm font-medium text-primary">Review full brief and plan</summary><pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{kickoffMarkdown(k)}</pre></details>
          <div className="space-y-3">{(Object.keys(reviewLabels) as (keyof typeof reviewLabels)[]).map(key => <label key={key} className="flex items-start gap-3 text-sm"><input type="checkbox" aria-label={reviewLabels[key]} className="mt-1" checked={k.review[key]} disabled={locked} onChange={e => setK(prev => ({ ...prev, review: { ...prev.review, [key]: e.target.checked } }))} />{reviewLabels[key]}</label>)}</div>
          <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => download("relay-project-brief.md", kickoffMarkdown(k), "text/markdown")}><Download /> Download brief</Button>{k.exportedProjectId ? <Button asChild><Link href={`/projects/${k.exportedProjectId}`}><ArrowRight /> Open project</Link></Button> : <Button disabled={saving || !Object.values(k.review).every(Boolean)} onClick={exportToRelay}>{saving ? <Loader2 className="animate-spin" /> : <Rocket />} Complete Kickoff</Button>}</div>
        </>}
      </section><KickoffGuidance step={k.step} /></div>
      {k.step >= 2 && kickoffSizeIssue(k) && <p role="status" className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{kickoffSizeIssue(k)}</p>}
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5"><Button variant="ghost" disabled={k.step === 0 || locked} onClick={() => { setK(prev => ({ ...prev, step: prev.step - 1 })); setError(""); }}><ArrowLeft /> Back</Button><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || saving} onClick={pause}><Pause /> Save checkpoint & pause</Button>{k.step < 5 && <Button disabled={locked} onClick={continueStep}><ArrowRight />{k.step === 2 ? "Save reviewed brief & continue" : k.step === 3 ? "Save reviewed tasks & continue" : "Continue"}</Button>}</div></footer>
    </>}
    <input type="file" accept=".json,application/json" ref={upload} className="hidden" aria-label="Upload checkpoint" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 1000000) setError("Checkpoint is too large."); else restore(await file.text()); e.target.value = ""; }} />
    <Dialog open={pauseOpen} onOpenChange={setPauseOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Save checkpoint & pause</DialogTitle><DialogDescription>Step {k.step + 1} of 6 · {kickoffSteps[k.step]}. Your file or resume code contains your answers and drafts; keep it privately.</DialogDescription></DialogHeader><div className="flex flex-wrap gap-2"><Button onClick={() => { download(`relay-kickoff-step-${k.step + 1}.json`, JSON.stringify(kickoffSchema.parse(k), null, 2), "application/json;charset=utf-8"); setSecured(true); }}><Download /> Download checkpoint</Button><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(checkpointCode(k)); setCopied(true); setSecured(true); setCheckpointError(""); } catch { setCheckpointError("Could not copy. Select the resume code below and copy it, or download the file."); } }}>{copied ? <Check /> : <Copy />} {copied ? "Code copied" : "Copy resume code"}</Button></div><Field label="Resume code"><textarea aria-label="Checkpoint code" readOnly className={`${field} font-mono text-xs`} rows={4} value={checkpointCode(k)} onFocus={e => e.currentTarget.select()} /></Field>{checkpointError && <p role="alert" className="text-sm text-destructive">{checkpointError}</p>}{copied && <p role="status" className="text-sm text-accent">Resume code copied.</p>}<Button disabled={!secured} onClick={() => { setPauseOpen(false); setPaused(true); }}><Pause /> Pause now</Button></DialogContent></Dialog>
    <Dialog open={resumeOpen} onOpenChange={setResumeOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Resume Kickoff</DialogTitle><DialogDescription>Upload a checkpoint or paste its code. This replaces the current session’s answers.</DialogDescription></DialogHeader><Button variant="outline" onClick={() => upload.current?.click()}><Upload /> Upload checkpoint</Button><textarea aria-label="Resume code" className={field} rows={5} value={resume} onChange={e => setResume(e.target.value)} placeholder="RELAY1.…" /><Button disabled={!resume.trim()} onClick={() => restore(resume)}><ArrowRight /> Restore code</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</DialogContent></Dialog>
  </>;
}
export default function KickoffPage() {
  const { isLoaded, isSignedIn } = useAuth();
  return <AppShell>{!isLoaded ? <LoadingBlock /> : isSignedIn ? <KickoffBody /> : <section className="py-16"><Rocket className="mb-4 h-8 w-8 text-primary" /><h1 className="font-display text-3xl">Kickoff</h1><p className="my-4 text-muted-foreground">Sign in to start or resume your project kickoff.</p><Button asChild><Link href="/sign-in?next=%2Fkickoff">Sign in</Link></Button></section>}</AppShell>;
}