import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { unzipSync, strFromU8 } from "fflate";
import { Download, Github, Loader2, MessageSquare, Plug, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/shell";
import { Empty, Field, LoadingBlock, PageHeader, Pill, ago, btn, field } from "@/components/kit";
import { usePageTitle } from "@/lib/workspace";
import { useListGithubRepos, getGetHubStateQueryKey } from "@/lib/hub-api";
import { approveImportFn, discardImportFn, getImportsFn, importRepoFn, unlinkRepoFn } from "@/lib/hub/hub.functions";
import { IMPORT_TEXT_LIMIT, parseExport, sourceLabels, type ImportContent, type ImportDraft, type ImportSource } from "@/lib/hub/imports";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

const errMsg = (e: unknown) => { const m = e instanceof Error ? e.message : String(e); try { return (JSON.parse(m) as { message: string }).message; } catch { return m; } };
const importsKey = ["hub", "imports"] as const;

function useImports() {
  const fn = useServerFn(getImportsFn);
  return useQuery({ queryKey: importsKey, queryFn: () => fn() });
}

function ChatImport({ onDone }: { onDone: () => void }) {
  const [source, setSource] = useState<ImportSource>("chatgpt");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [choices, setChoices] = useState<{ title: string; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const readFile = async (file: File) => {
    try {
      let raw: string;
      if (file.name.endsWith(".zip")) {
        const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
        const entry = Object.keys(files).find(n => n.endsWith("conversations.json"));
        if (!entry) throw new Error("No conversations.json found in this zip.");
        raw = strFromU8(files[entry]!);
      } else raw = await file.text();
      if (file.name.endsWith(".json") || file.name.endsWith(".zip")) {
        const chats = parseExport(JSON.parse(raw));
        if (!chats.length) throw new Error("No conversations found in this file.");
        if (chats.length === 1) { setTitle(chats[0]!.title); setText(chats[0]!.text); setChoices([]); }
        else setChoices(chats.slice(0, 300));
      } else { setText(raw); setTitle(file.name.replace(/\.[^.]+$/, "")); }
    } catch (e) { toast.error(errMsg(e)); }
  };
  const draft = async () => {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in again to import.");
      const r = await fetch("/api/import-draft", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ source, title, text }) });
      const body = await r.json().catch(() => ({ message: "Import failed." }));
      if (!r.ok) throw new Error(body.message);
      toast.success(body.trimmed ? "Draft ready. This chat was long, so only the most recent part was used." : "Draft ready to review below.");
      setText(""); setTitle(""); setChoices([]); onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{(["chatgpt", "claude", "perplexity", "other"] as const).map(s => (
        <button key={s} onClick={() => setSource(s)} className={cn("rounded-full border px-3 py-1 text-sm", source === s ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>{sourceLabels[s]}</button>
      ))}</div>
      <p className="text-sm text-muted-foreground">
        {source === "chatgpt" ? "Paste the chat, or upload your ChatGPT export (Settings → Data controls → Export; the .zip works)." : source === "claude" ? "Paste the chat, or upload your Claude export (conversations.json)." : source === "perplexity" ? "Perplexity has no export file. Open the thread, copy everything and paste it here." : "Paste the conversation."}
      </p>
      <label className={cn(btn.ghost, "inline-flex cursor-pointer items-center gap-2")}><Upload className="h-4 w-4" /> Upload file
        <input type="file" accept=".json,.zip,.md,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ""; }} />
      </label>
      {choices.length > 0 && (
        <Field label={`Pick a conversation (${choices.length} found)`}>
          <select className={field} value="" onChange={e => { const c = choices[Number(e.target.value)]; if (c) { setTitle(c.title); setText(c.text); setChoices([]); } }}>
            <option value="">Choose…</option>{choices.map((c, i) => <option key={i} value={i}>{c.title}</option>)}
          </select>
        </Field>
      )}
      <Field label="Chat title" hint="Optional"><input className={field} value={title} maxLength={200} onChange={e => setTitle(e.target.value)} /></Field>
      <Field label="Conversation" hint={text.length > IMPORT_TEXT_LIMIT ? `Long chat: only the most recent ${IMPORT_TEXT_LIMIT.toLocaleString()} characters will be used.` : `${text.length.toLocaleString()} characters`}>
        <textarea className={field} rows={8} value={text} onChange={e => setText(e.target.value)} placeholder="Paste the whole conversation here" data-testid="input-import-chat" />
      </Field>
      <button className={btn.primary} disabled={busy || text.trim().length < 20} onClick={draft} data-testid="button-import-draft">
        {busy ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Reading chat…</> : "Draft project with AI"}
      </button>
    </div>
  );
}

function GithubImport({ onDone }: { onDone: () => void }) {
  const repos = useListGithubRepos();
  const [repo, setRepo] = useState("");
  const [sync, setSync] = useState(true);
  const [busy, setBusy] = useState(false);
  const run = useServerFn(importRepoFn);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Creates a draft from the repo's description, README and open issues (as tasks). Read-only: nothing changes on GitHub.</p>
      {repos.isLoading ? <LoadingBlock /> : repos.error ? <p className="text-sm text-destructive">{errMsg(repos.error)}</p> : (
        <Field label="Repository">
          <select className={field} value={repo} onChange={e => setRepo(e.target.value)} data-testid="select-import-repo">
            <option value="">Choose a repository…</option>{(repos.data ?? []).map(r => <option key={r.name} value={r.name}>{r.name}{r.private ? " (private)" : ""}</option>)}
          </select>
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sync} onChange={e => setSync(e.target.checked)} /> Keep in sync (hourly check suggests new, closed and renamed issues)</label>
      <button className={btn.primary} disabled={!repo || busy} onClick={async () => {
        setBusy(true);
        try { await run({ data: { repo, keepSynced: sync } }); toast.success("Draft ready to review below."); setRepo(""); onDone(); }
        catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
      }}>{busy ? "Reading repo…" : "Draft project from repo"}</button>
    </div>
  );
}

function AssistantImport() {
  return (
    <div className="space-y-3 text-sm">
      <p>In ChatGPT or Claude (already connected to CarterHub), say:</p>
      <p className="rounded-lg border bg-secondary/40 p-3 font-medium">"Send this project to CarterHub."</p>
      <p className="text-muted-foreground">It sends a draft here using the import tool. Nothing is saved until you approve it. Not connected yet? <Link href="/connect" className="text-primary underline">Connect an assistant</Link>.</p>
    </div>
  );
}

function Review({ draft, projects, onDone }: { draft: ImportDraft; projects: { id: string; title: string }[]; onDone: () => void }) {
  const [c, setC] = useState<ImportContent>(draft.content);
  const [taskOn, setTaskOn] = useState(() => draft.content.tasks.map(() => true));
  const [ideaOn, setIdeaOn] = useState(() => draft.content.ideas.map(() => true));
  const [handoffOn, setHandoffOn] = useState(true);
  const [mode, setMode] = useState<"new" | "merge" | "">(draft.kind === "sync" ? "merge" : draft.matchProjectId ? "" : "new");
  const [target, setTarget] = useState(draft.matchProjectId ?? "");
  const [keepSynced, setKeepSynced] = useState(draft.keepSynced);
  const [busy, setBusy] = useState(false);
  const approve = useServerFn(approveImportFn), discard = useServerFn(discardImportFn);
  const match = projects.find(p => p.id === draft.matchProjectId);
  const isSync = draft.kind === "sync";
  const go = async (fn: () => Promise<unknown>, msg: string) => { setBusy(true); try { await fn(); toast.success(msg); onDone(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  const content = { ...c, tasks: c.tasks.filter((_, i) => taskOn[i]), ideas: c.ideas.filter((_, i) => ideaOn[i]), handoff: handoffOn ? c.handoff : null };
  return (
    <div className="space-y-4 rounded-xl border p-4" data-testid={`import-draft-${draft.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill value={draft.source} label={sourceLabels[draft.source]} />{draft.sourceDetail && <span className="text-xs text-muted-foreground">{draft.sourceDetail}</span>}
        <span className="ml-auto text-xs text-muted-foreground">{ago(draft.createdAt)}</span>
      </div>
      {isSync ? <h3 className="font-display text-lg">GitHub changes for {c.project.title}</h3> : (<>
        <Field label="Project name"><input className={field} value={c.project.title} maxLength={200} onChange={e => setC({ ...c, project: { ...c.project, title: e.target.value } })} /></Field>
        <Field label="Goal"><input className={field} value={c.project.goal} maxLength={2000} onChange={e => setC({ ...c, project: { ...c.project, goal: e.target.value } })} /></Field>
        <Field label="Summary"><textarea className={field} rows={4} value={c.project.description} onChange={e => setC({ ...c, project: { ...c.project, description: e.target.value.slice(0, 20000) } })} /></Field>
      </>)}
      {c.tasks.length > 0 && <div><p className="mb-2 text-sm font-medium">{isSync ? "New issues → tasks" : "Tasks"}</p>{c.tasks.map((t, i) => (
        <div key={i} className="mb-2 flex items-start gap-2">
          <input type="checkbox" className="mt-3" checked={taskOn[i]} onChange={e => setTaskOn(taskOn.map((v, j) => j === i ? e.target.checked : v))} />
          <input className={field} value={t.title} maxLength={200} onChange={e => setC({ ...c, tasks: c.tasks.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} />
          <select className={cn(field, "w-28")} value={t.priority} onChange={e => setC({ ...c, tasks: c.tasks.map((x, j) => j === i ? { ...x, priority: e.target.value as "low" } : x) })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
        </div>))}</div>}
      {isSync && (draft.changes?.close.length || draft.changes?.rename.length) ? <ul className="space-y-1 text-sm">
        {draft.changes?.close.map(x => <li key={x.taskId}>Mark done: <b>{x.title}</b> (issue #{x.issueNumber} closed)</li>)}
        {draft.changes?.rename.map(x => <li key={x.taskId}>Rename: {x.from} → <b>{x.title}</b></li>)}
        <li className="text-xs text-muted-foreground">Tasks you've edited since the last sync are skipped.</li>
      </ul> : null}
      {c.ideas.length > 0 && <div><p className="mb-2 text-sm font-medium">Ideas (go to your Ideas inbox)</p>{c.ideas.map((t, i) => (
        <label key={i} className="mb-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={ideaOn[i]} onChange={e => setIdeaOn(ideaOn.map((v, j) => j === i ? e.target.checked : v))} />{t.title}</label>))}</div>}
      {c.handoff && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={handoffOn} onChange={e => setHandoffOn(e.target.checked)} /><span>Save checkpoint: <b>{c.handoff.title}</b> — next: {c.handoff.nextAction}</span></label>}
      {!isSync && (
        <div className="space-y-2 rounded-lg bg-secondary/40 p-3 text-sm">
          {match && <p>This looks like your existing project <b>{match.title}</b>. What should happen?</p>}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2"><input type="radio" checked={mode === "new"} onChange={() => setMode("new")} /> Create new project</label>
            <label className="flex items-center gap-2"><input type="radio" checked={mode === "merge"} onChange={() => setMode("merge")} /> Merge into existing</label>
          </div>
          {mode === "merge" && <select className={field} value={target} onChange={e => setTarget(e.target.value)}><option value="">Choose project…</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select>}
          {draft.repo && <label className="flex items-center gap-2"><input type="checkbox" checked={keepSynced} onChange={e => setKeepSynced(e.target.checked)} /> Keep in sync with {draft.repo}</label>}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button className={btn.ghost} disabled={busy} onClick={() => go(() => discard({ data: { id: draft.id } }), "Discarded.")}><Trash2 className="mr-1 inline h-4 w-4" />Discard</button>
        <button className={btn.primary} data-testid="button-approve-import" disabled={busy || !mode || (mode === "merge" && !isSync && !target) || !c.project.title.trim()}
          onClick={() => go(() => approve({ data: { data: { id: draft.id, mode: mode as "new", ...(mode === "merge" && !isSync ? { targetProjectId: target } : {}), content, keepSynced } } }), isSync ? "GitHub changes applied." : "Imported.")}>
          {isSync ? "Apply changes" : "Approve & save"}
        </button>
      </div>
    </div>
  );
}

export default function ImportPage() {
  usePageTitle("Import", "Bring in projects you started in ChatGPT, Claude, Perplexity or GitHub.");
  const [tab, setTab] = useState<"chat" | "assistant" | "github">("chat");
  const q = useImports();
  const qc = useQueryClient();
  const unlink = useServerFn(unlinkRepoFn);
  const refresh = () => { void qc.invalidateQueries({ queryKey: importsKey }); void qc.invalidateQueries({ queryKey: getGetHubStateQueryKey() }); };
  const tabs = [{ id: "chat", label: "Paste or upload chat", icon: MessageSquare }, { id: "assistant", label: "From your assistant", icon: Plug }, { id: "github", label: "GitHub repo", icon: Github }] as const;
  const pending = q.data?.imports ?? [];
  return (
    <AppShell>
      <PageHeader eyebrow="Bring it in" title="Import" lede="Bring in projects you started elsewhere. Everything lands in your inbox for review first." />
      <div className="mb-4 flex flex-wrap gap-2">{tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", tab === t.id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}><t.icon className="h-4 w-4" />{t.label}</button>
      ))}</div>
      <section className="mb-8 rounded-xl border p-4">{tab === "chat" ? <ChatImport onDone={refresh} /> : tab === "github" ? <GithubImport onDone={refresh} /> : <AssistantImport />}</section>
      <h2 className="mb-3 font-display text-xl">Import inbox {pending.length > 0 && <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{pending.length}</span>}</h2>
      {q.isLoading ? <LoadingBlock /> : q.error ? <p className="text-sm text-destructive">{errMsg(q.error)}</p> : pending.length === 0
        ? <Empty icon={<Download className="h-6 w-6" />} title="Nothing waiting" body="Drafts from chats, assistants and GitHub show up here for you to review." />
        : <div className="space-y-4">{pending.map(d => <Review key={d.id} draft={d} projects={q.data?.projects ?? []} onDone={refresh} />)}</div>}
      {(q.data?.links.length ?? 0) > 0 && (<>
        <h2 className="mb-3 mt-8 font-display text-xl">Synced repositories</h2>
        <ul className="space-y-2">{q.data!.links.map(l => (
          <li key={l.projectId} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
            <Github className="h-4 w-4" /><b>{l.repo}</b> → {q.data!.projects.find(p => p.id === l.projectId)?.title ?? "Project"}
            <span className="text-muted-foreground">· checked {l.lastSyncedAt ? ago(l.lastSyncedAt) : "not yet"}</span>
            <button className={cn(btn.ghost, "ml-auto")} onClick={async () => { try { await unlink({ data: { id: l.projectId } }); toast.success("Sync turned off."); refresh(); } catch (e) { toast.error(errMsg(e)); } }}>Stop syncing</button>
          </li>))}</ul>
      </>)}
    </AppShell>
  );
}
