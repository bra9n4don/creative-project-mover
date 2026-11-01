import { useState, type ReactNode } from "react";
import { Link, useLocation } from "@/lib/router-compat";
import { useUser } from "@/lib/auth";
import { ListChecks, Bookmark, FolderKanban, History, Lightbulb, Menu, Plug, Settings, ShieldCheck, Sunrise, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { useOnboarding } from "@/lib/use-onboarding";

const primaryNav = [
  { href: "/overview", label: "Where I left off", icon: Sunrise },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/handoffs", label: "Checkpoints", icon: Bookmark },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
];
const secondaryNav = [
  { href: "/connections", label: "AI tools", icon: Plug },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/activity", label: "Activity log", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/setup", label: "Setup", icon: ListChecks },
];

function Logo() {
  return (
    <Link href="/" data-testid="link-home" className="flex items-center gap-2.5">
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="h-8 w-8 rounded-lg" />
      <span className="font-display text-xl font-semibold tracking-tight">Relay</span>
    </Link>
  );
}

function NavList({ onNav }: { onNav?: () => void }) {
  const [loc] = useLocation();
  const { state, isDemo } = useWorkspace();
  const { user } = useUser();
  const pending = state?.summary.pendingApprovals ?? 0;
  const { progress } = useOnboarding();
  const item = (n: (typeof primaryNav)[number]) => {
    const active = loc === n.href || (n.href !== "/overview" && loc.startsWith(n.href)) || (n.href === "/overview" && loc === "/");
    return (
      <Link
        key={n.href}
        href={n.href}
        onClick={onNav}
        data-testid={`link-nav-${n.href.slice(1)}`}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors",
          active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        <n.icon className={cn("h-4 w-4", active && "text-sidebar-primary")} />
        <span className="flex-1">{n.label}</span>
        {n.href === "/approvals" && pending > 0 && (
          <span className="rounded-full bg-sidebar-primary px-1.5 font-mono text-[10px] text-sidebar-primary-foreground">{pending}</span>
        )}
        {n.href === "/setup" && !progress.complete && (
          <span className="rounded-full border border-sidebar-primary px-1.5 font-mono text-[10px] text-sidebar-primary">{progress.done}/{progress.total}</span>
        )}
      </Link>
    );
  };
  return (
    <div className="flex h-full flex-col">
      <nav className="space-y-0.5">{primaryNav.map(item)}</nav>
      <div className="mb-2 mt-7 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/40">Behind the scenes</div>
      <nav className="space-y-0.5">{secondaryNav.map(item)}</nav>
      <div className="mt-auto pt-6">
        {isDemo ? (
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-sidebar-primary">Preview workspace</div>
            <p className="mt-1 text-xs leading-relaxed text-sidebar-foreground/70">Sample data only. Your own space starts empty and private.</p>
            <Link href="/sign-up" onClick={onNav} data-testid="link-sidebar-signup" className="mt-3 block rounded-lg bg-sidebar-primary px-3 py-2 text-center text-xs font-semibold text-sidebar-primary-foreground">
              Start my workspace
            </Link>
          </div>
        ) : (
          <Link href="/settings" onClick={onNav} data-testid="link-account" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent/60">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-primary/20 font-mono text-xs text-sidebar-primary">
              {(user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? "R").toUpperCase()}
            </div>
            <div className="min-w-0 text-xs">
              <div className="truncate font-medium text-sidebar-foreground">{user?.fullName || "My workspace"}</div>
              <div className="truncate text-sidebar-foreground/50">{user?.primaryEmailAddress?.emailAddress}</div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { isDemo, authLoaded } = useWorkspace();
  return (
    <div className="min-h-[100dvh] bg-background">
      <aside className="dark fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar px-4 py-5 text-sidebar-foreground md:flex">
        <div className="mb-8 px-1 [&_span]:text-sidebar-foreground">
          <Logo />
        </div>
        <NavList />
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <button data-testid="button-menu" onClick={() => setOpen(true)} className="rounded-lg border p-2" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 bg-sidebar p-4 text-sidebar-foreground [&>button]:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="mb-6 flex items-center justify-between">
            <span className="font-display text-xl font-semibold">Relay</span>
            <button onClick={() => setOpen(false)} data-testid="button-close-menu" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <NavList onNav={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="md:pl-64">
        {authLoaded && isDemo && (
          <div data-testid="banner-preview" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-primary/20 bg-primary/[0.07] px-4 py-2 text-[13px] md:px-10">
            <span className="rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-foreground">Preview workspace</span>
            <span className="text-foreground/80">You are looking at sample projects. Click around freely; saving needs your own workspace.</span>
            <Link href="/sign-in" data-testid="link-banner-signin" className="ml-auto font-medium text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}
