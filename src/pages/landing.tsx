import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/shell";
import { OverviewBody } from "@/pages/overview";
import { btn } from "@/components/kit";
import { usePageTitle } from "@/lib/workspace";

export default function Landing() {
  usePageTitle("Where you left off", "Relay remembers where you left off on every project, across all your AI tools.");
  return (
    <AppShell>
      <section className="rise mb-10 grid gap-6 border-b pb-10 md:grid-cols-[1.3fr_1fr] md:items-end">
        <div>
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Your project memory</div>
          <h1 className="font-display text-4xl font-semibold leading-[1.02] md:text-6xl">
            Got distracted?
            <br />
            <span className="text-primary">Here's where you were.</span>
          </h1>
        </div>
        <div>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            You bounce between ChatGPT, Claude, Cursor and four more. Relay keeps one plan per project and the last checkpoint you saved, so
            coming back takes seconds instead of a scroll through old chats. Below is a sample workspace. Poke around.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/sign-up" className={btn.primary} data-testid="link-hero-signup">
              Start my workspace <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/sign-in" className={btn.ghost} data-testid="link-hero-signin">
              I have an account
            </Link>
          </div>
        </div>
      </section>
      <OverviewBody />
    </AppShell>
  );
}
