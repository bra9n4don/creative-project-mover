import { useEffect, useState } from "react";
import { ListChecks, X } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { useAuth } from "@/lib/auth";
import { useOnboarding } from "@/lib/use-onboarding";
import { btn } from "@/components/kit";

const KEY = "relay.setup-banner-dismissed";

export function SetupBanner() {
  const { isSignedIn } = useAuth();
  const { progress, isLoading } = useOnboarding();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => setDismissed(localStorage.getItem(KEY) === "1"), []);
  if (!isSignedIn || isLoading || dismissed || progress.complete) return null;
  return (
    <div data-testid="setup-banner" className="rise mb-6 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <ListChecks className="h-5 w-5 shrink-0 text-primary" />
      <p className="flex-1 text-sm">Finish setting up Relay: {progress.done} of {progress.total} steps done.</p>
      <Link href="/setup" className={btn.primary}>Continue setup</Link>
      <button aria-label="Dismiss" className="rounded p-1 hover:bg-secondary" onClick={() => { localStorage.setItem(KEY, "1"); setDismissed(true); }}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
