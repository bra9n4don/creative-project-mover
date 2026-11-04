import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completeTourFn, getTourStatusFn } from "@/lib/hub/hub.functions";
import { cn } from "@/lib/utils";

type Step = { title: string; body: string; targets: string[] };
// Targets are tried in order; the first one visible on screen is highlighted (sidebar on desktop, tabs on phone).
export const TOUR_STEPS: Step[] = [
  { title: "Welcome to Relay", body: "A quick tour of where everything lives. It takes under a minute, and you can skip any time.", targets: [] },
  { title: "Where I left off", body: "Your latest checkpoint and the one next action, so you can pick up right away.", targets: ["link-nav-overview", "tab-overview"] },
  { title: "Projects", body: "Every project with its tasks, checkpoints and GitHub activity. Open one to paste an update and let AI draft tasks.", targets: ["link-nav-projects", "tab-projects"] },
  { title: "Ideas", body: "Your inbox for loose thoughts. Turn any idea into a project when it's ready.", targets: ["link-nav-ideas", "tab-ideas"] },
  { title: "Quick capture", body: "Tap + from any screen to jot an idea in seconds.", targets: ["button-quick-capture"] },
  { title: "Kickoff", body: "Six guided steps to start a project: brainstorm, clarify, define, plan, risks and launch review.", targets: ["link-nav-kickoff", "tab-kickoff"] },
  { title: "Mind map", body: "Brainstorm visually, then save branches to Ideas or promote them into projects.", targets: ["link-nav-mind-map", "tab-more"] },
  { title: "Connect assistant", body: "Link ChatGPT or Claude so they can read your context and save checkpoints for you.", targets: ["link-nav-connect", "tab-more"] },
  { title: "Settings", body: "GitHub sync, your private backup, iPhone install, and a button to replay this tour.", targets: ["link-nav-settings", "tab-more"] },
];

export const TOUR_EVENT = "relay:start-tour";
export const startTour = () => window.dispatchEvent(new Event(TOUR_EVENT));

function findTarget(ids: string[]): DOMRect | null {
  for (const id of ids) {
    for (const el of document.querySelectorAll(`[data-testid="${id}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight) return r;
    }
  }
  return null;
}

export function GuidedTour() {
  const getStatus = useServerFn(getTourStatusFn);
  const complete = useServerFn(completeTourFn);
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    let live = true;
    getStatus().then(r => { if (live && !(r as { completed: boolean }).completed) setStep(0); }).catch(() => {});
    const open = () => setStep(0);
    window.addEventListener(TOUR_EVENT, open);
    return () => { live = false; window.removeEventListener(TOUR_EVENT, open); };
  }, [getStatus]);

  const close = useCallback(() => { setStep(null); complete().catch(() => {}); }, [complete]);

  useLayoutEffect(() => {
    if (step === null) return;
    const measure = () => setRect(findTarget(TOUR_STEPS[step]!.targets));
    measure();
    addEventListener("resize", measure); addEventListener("scroll", measure, true);
    return () => { removeEventListener("resize", measure); removeEventListener("scroll", measure, true); };
  }, [step]);

  useEffect(() => {
    if (step === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setStep(s => (s !== null && s < TOUR_STEPS.length - 1 ? s + 1 : s));
      if (e.key === "ArrowLeft") setStep(s => (s ? s - 1 : s));
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [step, close]);

  if (step === null) return null;
  const s = TOUR_STEPS[step]!;
  const last = step === TOUR_STEPS.length - 1;
  const pad = 6;
  const hole = rect && { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  // Card sits beside the target: right of a sidebar item, above a bottom tab, otherwise centered.
  const card: React.CSSProperties = !hole ? { top: "50%", left: "50%", transform: "translate(-50%,-50%)" }
    : hole.left + hole.width + 340 < innerWidth && hole.top < innerHeight - 220 ? { top: Math.max(12, hole.top), left: hole.left + hole.width + 14 }
    : hole.top > innerHeight / 2 ? { bottom: innerHeight - hole.top + 14, left: 12, right: 12 }
    : { top: hole.top + hole.height + 14, left: 12, right: 12 };

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="tour-title" data-testid="guided-tour">
      {hole ? (
        <div className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-200"
          style={{ ...hole, boxShadow: "0 0 0 9999px hsl(var(--background) / 0.75)" }} />
      ) : <div className="absolute inset-0 bg-background/75" />}
      <div className={cn("absolute w-auto max-w-sm rounded-2xl border bg-card p-5 text-card-foreground shadow-xl", !hole && "w-[min(24rem,calc(100vw-24px))]")} style={card}>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-primary">Step {step + 1} of {TOUR_STEPS.length}</div>
        <h2 id="tour-title" className="mt-1 font-display text-lg font-semibold">{s.title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={close} data-testid="button-tour-skip" className="mr-auto text-sm text-muted-foreground underline-offset-4 hover:underline">{last ? "Close" : "Skip tour"}</button>
          {step > 0 && <button onClick={() => setStep(step - 1)} data-testid="button-tour-back" className="rounded-lg border px-3 py-1.5 text-sm">Back</button>}
          <button onClick={() => (last ? close() : setStep(step + 1))} data-testid="button-tour-next" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{last ? "Done" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
