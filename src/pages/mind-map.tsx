import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Network } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { useAuth } from "@/lib/auth";
import { errMessage } from "@/lib/workspace";
import { getMindMapFn, saveMindMapFn } from "@/lib/hub/hub.functions";
import type { MindMap } from "@/lib/kickoff";
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
    } catch (e) { pending.current ??= next; setSaveError(errMessage(e)); setStatus("Not saved"); }
    finally { saving.current = false; if (pending.current && !saveError) timer.current = setTimeout(() => void flush(), 800); }
  };
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
    <KickoffMindMap value={map} onChange={change} hint="Click a node to rename it or change its type. Drag from a node's right dot to another node to link them." />
    <p className="mt-6 text-sm text-muted-foreground">Ready to turn an idea into a project? <Link className="text-primary" href="/kickoff">Start a Kickoff</Link></p>
  </>;
}

export default function MindMapPage() {
  const { isLoaded, isSignedIn } = useAuth();
  return <AppShell>{!isLoaded ? <LoadingBlock /> : isSignedIn ? <MindMapBody /> : <section className="py-16"><Network className="mb-4 h-8 w-8 text-primary" /><h1 className="font-display text-3xl">Mind map</h1><p className="my-4 text-muted-foreground">Sign in to open your saved mind map.</p><Button asChild><Link href="/sign-in?next=%2Fmind-map">Sign in</Link></Button></section>}</AppShell>;
}
