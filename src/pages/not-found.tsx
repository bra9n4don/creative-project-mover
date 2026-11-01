import { Link } from "wouter";
import { btn } from "@/components/kit";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-primary">404</div>
        <h1 className="mt-2 font-display text-4xl font-semibold">You wandered off the map</h1>
        <p className="mt-2 text-muted-foreground">This page doesn't exist. Your projects are right where you left them.</p>
        <Link href="/" className={`${btn.primary} mt-6`} data-testid="link-404-home">Back to Relay</Link>
      </div>
    </div>
  );
}
