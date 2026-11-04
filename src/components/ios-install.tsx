import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";

const KEY = "relay-ios-install-dismissed";

/** True on iPhone/iPad Safari when Relay is not already running from the Home Screen. */
export function useIosInstallable() {
  const [v, setV] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const standalone = (navigator as { standalone?: boolean }).standalone || window.matchMedia("(display-mode: standalone)").matches;
    setV(ios && !standalone);
  }, []);
  return v;
}

export function InstallSteps() {
  return (
    <ol className="space-y-2 text-sm">
      <li className="flex gap-2"><span className="font-mono text-primary">1</span>Open carterhub.carterlab.app in Safari.</li>
      <li className="flex gap-2"><span className="font-mono text-primary">2</span><span>Tap the Share button <Share className="inline h-4 w-4" /> at the bottom.</span></li>
      <li className="flex gap-2"><span className="font-mono text-primary">3</span><span>Choose <b>Add to Home Screen</b> <SquarePlus className="inline h-4 w-4" />, then tap <b>Add</b>.</span></li>
      <li className="flex gap-2"><span className="font-mono text-primary">4</span>Open Relay from its icon and sign in once.</li>
    </ol>
  );
}

export function IosInstallBanner() {
  const installable = useIosInstallable();
  const [hidden, setHidden] = useState(true);
  useEffect(() => setHidden(localStorage.getItem(KEY) === "1"), []);
  if (!installable || hidden) return null;
  return (
    <div data-testid="banner-ios-install" className="flex items-start gap-3 border-b border-primary/20 bg-primary/[0.07] px-4 py-2.5 text-[13px] md:hidden">
      <Share className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="flex-1">Install Relay: tap Share, then <b>Add to Home Screen</b>.</span>
      <button aria-label="Dismiss" onClick={() => { localStorage.setItem(KEY, "1"); setHidden(true); }}><X className="h-4 w-4" /></button>
    </div>
  );
}
