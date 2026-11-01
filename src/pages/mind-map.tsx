import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useBlocker } from "@tanstack/react-router";
import { ArrowUpRight, FolderPlus, Lightbulb, Network } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { useAuth } from "@/lib/auth";
import { errMessage } from "@/lib/workspace";
import { getMindMapFn, promoteClusterFn, saveMindMapFn } from "@/lib/hub/hub.functions";
import { branchOutline, mindMapClusters, type MindMap } from "@/lib/kickoff";
import { useCreateIdea, usePromoteIdea } from "@/lib/hub-api";
import { useHubResult } from "@/lib/workspace";
import { KickoffMindMap, emptyMindMap } from "@/components/kickoff-mind-map";
import { AppShell } from "@/components/shell";
import { ErrorBlock, LoadingBlock } from "@/components/kit";
import { Button } from "@/components/ui/button";

/** Standalone brainstorm map: one saved map per workspace, autosaved after you stop editing. */
function MindMapBody() {
  const load = useServerFn(getMindMapFn);
  const save = useServerFn(saveMindMapFn);
  const [map, setMap] = useState<MindMap | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [status, setStatus] = useState("Loading…");
  const [saveError, setSaveError] = useState("");
  const revision = useRef(0);
  const pending = useRef<MindMap | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const createIdea = useCreateIdea();
  const promoteIdea = usePromoteIdea();
  const promoteFn = useServerFn(promoteClusterFn);
  const result = useHubResult();
  const [busyCluster, setBusyCluster] = useState<string | null>(null);
  const [made, setMade] = useState<Record<string, string>>({});
  const saveIdea = (node: MindMap["nodes"][number], andPromote: boolean) => {
    if (!map || !node.label.trim()) return;
    const description = branchOutline(map, node.id).slice(0, 2000);
    createIdea.mutate({ data: { title: node.label.trim().slice(0, 150), description, tags: ["mind-map"] } }, andPromote
      ? { onSuccess: idea => promoteIdea.mutate({ id: idea.id }, result("Saved to Ideas and made a project")), onError: result("").onError }
      : result("Saved to your Ideas inbox"));
  };
  const promoteCluster = async (c: ReturnType<typeof mindMapClusters>[number]) => {
    setBusyCluster(c.title);
    const r = result(`"${c.title}" is now a project`);
    try { const res = await promoteFn({ data: { data: c } }) as { id?: string }; if (res.id) setMade(m => ({ ...m, [c.title]: res.id! })); r.onSuccess(res); }
    catch (e) { r.onError(e); } finally { setBusyCluster(null); }
  };

  const fetchMap = async () => {
    setLoadError(null);
    try {
      const saved = await load();
      revision.current = saved?.revision ?? 0;
      setMap(saved?.map ?? emptyMindMap("My brainstorm"));
      setStatus(saved ? `Saved ${new Date(saved.updatedAt).toLocaleString()}` : "Not saved yet");
    } catch (e) { setLoadError(e); }
  };
  useEffect(() => { void fetchMap(); return () => { if (timer.current) clearTimeout(timer.current); }; }, []);

  const flush = async () => {
    if (saving.current || !pending.current) return;
    const next = pending.current; pending.current = null; saving.current = true;
    setStatus("Saving…");
    try {
      const saved = await save({ data: { data: { map: next, title: next.nodes[0]?.label ?? "My brainstorm", expectedRevision: revision.current } } });
      revision.current = saved.revision; setSaveError(""); setStatus("All changes saved");
      saving.current = false;
      if (pending.current) timer.current = setTimeout(() => void flush(), 800);
      return true;
    } catch (e) { pending.current ??= next; saving.current = false; setSaveError(errMessage(e)); setStatus("Not saved"); return false; }
  };
  const flushNow = async () => {
    if (timer.current) clearTimeout(timer.current);
    while (saving.current) await new Promise(r => setTimeout(r, 50));
    return pending.current ? flush() : true;
  };
  useBlocker({
    shouldBlockFn: async () => !(await flushNow()),
    enableBeforeUnload: () => !!pending.current || saving.current,
  });
  const change = (m: MindMap) => {
    setMap(m); pending.current = m; setStatus("Unsaved changes");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  };

  if (loadError) return <ErrorBlock error={loadError as Error} onRetry={() => void fetchMap()} />;
  if (!map) return <LoadingBlock />;
  return <>
    <header className="mb-6"><div className="mb-2 flex items-center gap-2 text-sm text-primary"><Network className="h-4 w-4" /> Brainstorm</div><h1 className="font-display text-3xl font-semibold">Mind map</h1><p className="mt-2 text-sm text-muted-foreground">A free space to map ideas outside Kickoff. It saves automatically to your workspace.</p></header>
    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span role="status">{status}</span>{saveError && <><span role="alert" className="text-destructive">{saveError}</span><Button size="sm" variant="outline" onClick={() => { setSaveError(""); void flush(); }}>Retry saving</Button></>}</div>
    <KickoffMindMap value={map} onChange={change} canvasClass="h-[calc(100vh-260px)] min-h-[520px]" hint="Click a node to rename it, change its type, or save it to Ideas. Drag from a node's right dot to another node to link them."
      nodeActions={node => <>
        <Button size="sm" variant="outline" disabled={createIdea.isPending || !node.label.trim()} onClick={() => saveIdea(node, false)}><Lightbulb /> Save to Ideas</Button>
        <Button size="sm" variant="outline" disabled={createIdea.isPending || promoteIdea.isPending || !node.label.trim()} onClick={() => saveIdea(node, true)}><ArrowUpRight /> Make it a project</Button>
      </>} />
    <section className="mt-8 border-t pt-6"><h2 className="font-display text-xl">Promote clusters</h2><p className="mt-1 text-sm text-muted-foreground">Each main branch is a cluster. Promoting one creates a planning project; its features and ideas become tasks, and its risks and questions go into the project notes.</p>
      {mindMapClusters(map).length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Add branches to your map to form clusters.</p> : <ul className="mt-4 divide-y border-y">{mindMapClusters(map).map(c => <li key={c.title} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-medium">{c.title}</div><div className="text-xs text-muted-foreground">{c.tasks.filter(t => t.title).length} tasks{c.outcome ? " · notes included" : ""}</div></div>{made[c.title] ? <Link className="text-sm text-primary" href={`/projects/${made[c.title]}`}>Open project</Link> : <Button size="sm" variant="secondary" disabled={busyCluster !== null} onClick={() => void promoteCluster(c)}><FolderPlus /> {busyCluster === c.title ? "Creating…" : "Make project"}</Button>}</li>)}</ul>}
    </section>
    <p className="mt-6 text-sm text-muted-foreground">Ready to turn an idea into a project? <Link className="text-primary" href="/kickoff">Start a Kickoff</Link></p>
  </>;
}

export default function MindMapPage() {
  const { isLoaded, isSignedIn } = useAuth();
  return <AppShell>{!isLoaded ? <LoadingBlock /> : isSignedIn ? <MindMapBody /> : <section className="py-16"><Network className="mb-4 h-8 w-8 text-primary" /><h1 className="font-display text-3xl">Mind map</h1><p className="my-4 text-muted-foreground">Sign in to open your saved mind map.</p><Button asChild><Link href="/sign-in?next=%2Fmind-map">Sign in</Link></Button></section>}</AppShell>;
}
