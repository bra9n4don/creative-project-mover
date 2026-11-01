import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useBlocker } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getKickoffsFn, saveKickoffFn } from "./hub/hub.functions";
import type { Kickoff, SavedKickoff } from "./kickoff";
import { errMessage } from "./workspace";

export function useKickoffSaving(k: Kickoff) {
  const saveFn = useServerFn(saveKickoffFn);
  const listFn = useServerFn(getKickoffsFn);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["kickoffs"], queryFn: () => listFn() });
  const current = useRef(k); current.current = k;
  const revisions = useRef(new Map<string, number>());
  const snapshots = useRef(new Map<string, string>());
  const completed = useRef(new Set<string>());
  const savedStep = useRef(new Map<string, number>());
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [status, setStatus] = useState("Not started");
  const [saveError, setSaveError] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const persist = useCallback((draft: Kickoff, reviewedStep?: number): Promise<SavedKickoff | undefined> => {
    const snapshot = JSON.stringify(draft);
    const work = queue.current.then(async () => {
      if (completed.current.has(draft.id) || (!draft.brainstorm.trim() && !revisions.current.has(draft.id))) return;
      if (reviewedStep === undefined && snapshots.current.get(draft.id) === snapshot) return;
      // A stale autosave queued behind a reviewed "Continue" must not move the saved step backwards.
      if (reviewedStep === undefined && draft.step < (savedStep.current.get(draft.id) ?? 0)) return;
      setStatus("Saving…"); setSaveError("");
      try {
        const result = await saveFn({ data: { data: { kickoff: draft, expectedRevision: revisions.current.get(draft.id) ?? 0, reviewedStep } } });
        revisions.current.set(draft.id, result.revision);
        snapshots.current.set(draft.id, snapshot);
        savedStep.current.set(draft.id, Math.max(draft.step, savedStep.current.get(draft.id) ?? 0));
        if (result.completed) completed.current.add(draft.id);
        setProjectId(result.projectId); setStatus("Saved to project");
        qc.setQueryData<SavedKickoff[]>(["kickoffs"], old => [...(old ?? []).filter(r => r.data.id !== result.data.id), result]);
        void qc.invalidateQueries({ queryKey: ["hub", "state"] });
        return result;
      } catch (e) { setStatus("Not saved"); setSaveError(errMessage(e)); throw e; }
    });
    queue.current = work.catch(() => undefined);
    return work;
  }, [saveFn, qc]);
  const dirty = k.brainstorm.trim() && !k.exportedProjectId && snapshots.current.get(k.id) !== JSON.stringify(k);
  useEffect(() => {
    if (!dirty) return;
    setStatus("Unsaved changes");
    const timer = setTimeout(() => { void persist(k).catch(() => undefined); }, 800);
    return () => clearTimeout(timer);
  }, [k, persist, dirty]);
  const flush = useCallback(() => persist(current.current), [persist]);
  useBlocker({
    shouldBlockFn: async () => {
      try { await flush(); return false; } catch { return true; }
    },
    enableBeforeUnload: () => !!current.current.brainstorm.trim() && !completed.current.has(current.current.id) && snapshots.current.get(current.current.id) !== JSON.stringify(current.current),
  });
  const activate = (record?: SavedKickoff) => {
    if (record) {
      revisions.current.set(record.data.id, record.revision);
      snapshots.current.set(record.data.id, JSON.stringify(record.data));
      savedStep.current.set(record.data.id, record.data.step);
      if (record.completed) completed.current.add(record.data.id);
    }
    setProjectId(record?.projectId ?? null); setStatus(record ? "Saved to project" : "Not started"); setSaveError("");
  };
  return { persist, flush, activate, projectId, status, saveError, saved: list.data ?? [], listError: list.error, loadingSaved: list.isLoading, reloadSaved: list.refetch };
}