import { useState, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Copy, Check, RotateCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { errMessage } from "@/lib/workspace";

export function ago(iso: string | null | undefined) {
  if (!iso) return "never";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export function PageHeader({ eyebrow, title, children, lede }: { eyebrow: string; title: string; lede?: string; children?: ReactNode }) {
  return (
    <div className="rise mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">{eyebrow}</div>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{title}</h1>
        {lede && <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-[15px]">{lede}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

const tone: Record<string, string> = {
  planning: "bg-secondary text-secondary-foreground",
  active: "bg-accent/12 text-accent",
  paused: "bg-[hsl(42_85%_50%/.15)] text-[hsl(42_85%_70%)]",
  completed: "bg-foreground/8 text-muted-foreground",
  todo: "bg-secondary text-secondary-foreground",
  in_progress: "bg-primary/12 text-primary",
  blocked: "bg-destructive/12 text-destructive",
  done: "bg-accent/12 text-accent",
  verified: "bg-accent text-accent-foreground",
  inbox: "bg-secondary text-secondary-foreground",
  exploring: "bg-primary/12 text-primary",
  promoted: "bg-accent/12 text-accent",
  archived: "bg-foreground/8 text-muted-foreground",
  pending: "bg-[hsl(42_85%_50%/.18)] text-[hsl(42_85%_70%)]",
  approved: "bg-accent/12 text-accent",
  rejected: "bg-destructive/10 text-destructive",
  not_configured: "bg-secondary text-muted-foreground",
  configured: "bg-[hsl(42_85%_50%/.18)] text-[hsl(42_85%_70%)]",
};

export function Pill({ value, label, className }: { value: string; label?: string; className?: string }) {
  return (
    <span
      data-testid={`status-${value}`}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider",
        tone[value] ?? "bg-secondary",
        className,
      )}
    >
      {label ?? value.replace("_", " ")}
    </span>
  );
}

export function Dot({ color, className }: { color?: string; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ background: color || "hsl(var(--primary))" }} />;
}

export function Bar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div className="h-full origin-left rounded-full transition-transform duration-700" style={{ transform: `scaleX(${pct / 100})`, background: color || "hsl(var(--accent))" }} />
    </div>
  );
}

export function Panel({ className, children, title, action }: { className?: string; children: ReactNode; title?: string; action?: ReactNode }) {
  return (
    <section className={cn("rise rounded-2xl border bg-card", className)}>
      {title && (
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ icon, title, body, children }: { icon: ReactNode; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="rise flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-dashed border-primary/40 bg-primary/5 text-primary">{icon}</div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" data-testid="loading">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="rise mx-auto max-w-md rounded-2xl border border-destructive/30 bg-card p-6 text-center">
      <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-destructive" />
      <h3 className="font-display text-lg font-semibold">Couldn't load your workspace</h3>
      <p className="mt-1 text-sm text-muted-foreground">{errMessage(error)}</p>
      <button data-testid="button-retry" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary">
        <RotateCw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}

export function Confirm({
  trigger,
  title,
  body,
  confirmLabel,
  onConfirm,
  destructive = true,
}: {
  trigger: ReactNode;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid="button-confirm"
            onClick={onConfirm}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-accent text-accent-foreground hover:bg-accent/90"}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CopyButton({ text, label = "Copy", className, testId }: { text: string; label?: string; className?: string; testId?: string }) {
  const [done, setDone] = useState<boolean | "failed">(false);
  return (
    <button
      type="button"
      data-testid={testId ?? "button-copy"}
      aria-live="polite"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => setDone(true), () => setDone("failed"))
          .finally(() => setTimeout(() => setDone(false), 2500));
      }}
      className={cn("inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary", className)}
    >
      {done === true ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
      {done === true ? "Copied" : done === "failed" ? "Couldn't copy — select it instead" : label}
    </button>
  );
}

export const btn = {
  primary: "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_1px_0_hsl(12_60%_35%)] transition-transform active:scale-[.98] disabled:opacity-50",
  ink: "inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform active:scale-[.98] disabled:opacity-50",
  ghost: "inline-flex items-center justify-center gap-2 rounded-lg border bg-card px-3.5 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50",
  danger: "inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/30 px-3.5 py-2 text-sm font-medium text-destructive hover:bg-destructive/5",
};

export const field = "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
