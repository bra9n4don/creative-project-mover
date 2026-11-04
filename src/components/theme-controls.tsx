import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { MODES, PALETTES } from "@/lib/theme";
import { cn } from "@/lib/utils";

const modeIcon = { light: Sun, dark: Moon, system: Monitor } as const;

export function ThemeSettings() {
  const { prefs, setPrefs } = useTheme();
  return (
    <div className="space-y-5 p-5 text-sm">
      <div>
        <div className="mb-2 font-medium">Mode</div>
        <div className="flex flex-wrap gap-2">
          {MODES.map(m => { const I = modeIcon[m]; return (
            <button key={m} data-testid={`theme-mode-${m}`} aria-pressed={prefs.mode === m} onClick={() => setPrefs({ mode: m })}
              className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 capitalize", prefs.mode === m ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>
              <I className="h-4 w-4" />{m}
            </button>
          ); })}
        </div>
      </div>
      <div>
        <div className="mb-2 font-medium">Color palette</div>
        <div className="flex flex-wrap gap-3">
          {PALETTES.map(p => (
            <button key={p.id} data-testid={`theme-palette-${p.id}`} aria-pressed={prefs.palette === p.id} onClick={() => setPrefs({ palette: p.id })}
              className={cn("flex items-center gap-2 rounded-lg border px-3 py-2", prefs.palette === p.id ? "border-primary" : "hover:bg-muted")}>
              <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: p.swatch }}>
                {prefs.palette === p.id && <Check className="h-3 w-3 text-primary-foreground" />}
              </span>{p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Saved to your account, so it follows you on every device.</p>
    </div>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { dark, setPrefs } = useTheme();
  const I = dark ? Sun : Moon;
  return (
    <button data-testid="button-theme-toggle" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setPrefs({ mode: dark ? "light" : "dark" })} className={className}>
      <I className="h-4 w-4" />
    </button>
  );
}
