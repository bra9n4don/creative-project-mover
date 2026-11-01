import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Link } from "@/lib/router-compat";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetHubState,
  useGetDemoState,
  getGetHubStateQueryKey,
  getGetDemoStateQueryKey,
  type HubState,
  type Handoff,
  type Project,
  type Task,
} from "@/lib/hub-api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";

type Ctx = {
  state: HubState | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  isDemo: boolean;
  authLoaded: boolean;
  guard: (reason: string, fn: () => void) => void;
};

const WorkspaceCtx = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const signedIn = !!isSignedIn;
  const hub = useGetHubState({
    query: { enabled: isLoaded && signedIn, queryKey: getGetHubStateQueryKey(), refetchInterval: 60000, refetchOnWindowFocus: true },
  });
  const demo = useGetDemoState({
    query: { enabled: isLoaded && !signedIn, queryKey: getGetDemoStateQueryKey() },
  });
  const q = signedIn ? hub : demo;
  const [gate, setGate] = useState<string | null>(null);
  const guard = useCallback(
    (reason: string, fn: () => void) => {
      if (!signedIn) {
        setGate(reason);
        return;
      }
      fn();
    },
    [signedIn],
  );

  return (
    <WorkspaceCtx.Provider
      value={{
        state: q.data,
        isLoading: !isLoaded || q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
        isDemo: !signedIn,
        authLoaded: isLoaded,
        guard,
      }}
    >
      {children}
      <Dialog open={!!gate} onOpenChange={(o) => !o && setGate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </div>
            <DialogTitle className="font-display text-xl">This is the preview workspace</DialogTitle>
            <DialogDescription className="leading-relaxed">
              {gate} Everything here is sample data, so nothing can be saved. Sign in to get your own private
              workspace, which starts empty and only ever holds what you put in it.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/sign-up"
              data-testid="link-gate-signup"
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
            >
              Create my workspace
            </Link>
            <Link
              href="/sign-in"
              data-testid="link-gate-signin"
              className="flex-1 rounded-lg border px-4 py-2.5 text-center text-sm font-medium"
            >
              Sign in
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </WorkspaceCtx.Provider>
  );
}

export function useWorkspace() {
  const c = useContext(WorkspaceCtx);
  if (!c) throw new Error("WorkspaceProvider missing");
  return c;
}

export function errMessage(e: unknown): string {
  const err = e as { status?: number; data?: unknown; message?: string } | null;
  const d = (err?.data ?? null) as { error?: string; message?: string } | null;
  if (err?.status === 409)
    return "This changed somewhere else (another AI tool or tab). The latest version has been loaded. Review it and try again.";
  if (err?.status === 401) return "Your session ended. Sign in again to continue.";
  return d?.error || d?.message || err?.message || "Something went wrong.";
}

export function useHubResult() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useCallback(
    (success: string, after?: () => void) => ({
      onSuccess: (r: unknown) => {
        void qc.invalidateQueries({ queryKey: getGetHubStateQueryKey() });
        const res = r as { approvalRequired?: boolean; message?: string } | undefined;
        if (res?.approvalRequired) toast({ title: "Sent for your approval", description: res.message });
        else toast({ title: success });
        after?.();
      },
      onError: (e: unknown) => {
        void qc.invalidateQueries({ queryKey: getGetHubStateQueryKey() });
        toast({ title: "Not saved", description: errMessage(e), variant: "destructive" });
      },
    }),
    [qc, toast],
  );
}

export function usePageTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = `${title} · Relay`;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [title, description]);
}

export function latestCheckpoint(handoffs: Handoff[], projectId: string): Handoff | undefined {
  return handoffs
    .filter((h) => h.projectId === projectId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
}

export function progressOf(tasks: Task[], projectId: string) {
  const t = tasks.filter((x) => x.projectId === projectId);
  const done = t.filter((x) => x.status === "done" || x.status === "verified").length;
  return { total: t.length, done, pct: t.length ? Math.round((done / t.length) * 100) : 0 };
}

/** The single next thing to do on a project: checkpoint next action, else first unblocked open task. */
export function nextStep(state: HubState, p: Project): { text: string; from: "checkpoint" | "task" | "none" } {
  const cp = latestCheckpoint(state.handoffs, p.id);
  if (cp?.nextAction) return { text: cp.nextAction, from: "checkpoint" };
  const open = state.tasks.filter((t) => t.projectId === p.id && ["in_progress", "todo"].includes(t.status));
  const pick = open.find((t) => t.status === "in_progress") ?? open[0];
  if (pick) return { text: pick.title, from: "task" };
  return { text: "", from: "none" };
}

export function lastTouched(state: HubState, p: Project): number {
  const times = [
    +new Date(p.updatedAt),
    ...state.handoffs.filter((h) => h.projectId === p.id).map((h) => +new Date(h.createdAt)),
    ...state.tasks.filter((t) => t.projectId === p.id).map((t) => +new Date(t.updatedAt)),
  ];
  return Math.max(...times);
}

export function checkpointText(p: Project | undefined, h: Handoff): string {
  return [
    `Project: ${p?.title ?? "Unknown project"}`,
    p?.goal ? `Goal: ${p.goal}` : "",
    `Checkpoint: ${h.title}`,
    `Where I left off:\n${h.summary}`,
    `Next action: ${h.nextAction}`,
    `Saved from: ${h.source || "Relay"}${h.target ? ` (continue in ${h.target})` : ""}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
