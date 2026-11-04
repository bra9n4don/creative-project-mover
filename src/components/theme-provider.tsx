import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getThemeFn, saveThemeFn } from "@/lib/hub/hub.functions";
import { DEFAULT_THEME, isDark, parseTheme, type ThemePrefs } from "@/lib/theme";

const KEY = "relay-theme";
type Ctx = { prefs: ThemePrefs; dark: boolean; setPrefs: (p: Partial<ThemePrefs>) => void };
const ThemeCtx = createContext<Ctx>({ prefs: DEFAULT_THEME, dark: false, setPrefs: () => {} });
export const useTheme = () => useContext(ThemeCtx);

function apply(p: ThemePrefs) {
  const dark = isDark(p.mode, matchMedia("(prefers-color-scheme: dark)").matches);
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.dataset.palette = p.palette;
  return dark;
}

/** Applies the saved theme; signed-in owners sync it to their account so it follows them across devices. */
export function ThemeProvider({ children, signedIn }: { children: ReactNode; signedIn: boolean }) {
  const getTheme = useServerFn(getThemeFn);
  const saveTheme = useServerFn(saveThemeFn);
  const [prefs, setState] = useState<ThemePrefs>(DEFAULT_THEME);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try { setState(parseTheme(JSON.parse(localStorage.getItem(KEY) ?? "null"))); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    getTheme().then(r => { if (live) { const p = parseTheme(r); setState(p); localStorage.setItem(KEY, JSON.stringify(p)); } }).catch(() => {});
    return () => { live = false; };
  }, [signedIn, getTheme]);
  useEffect(() => {
    setDark(apply(prefs));
    if (prefs.mode !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => setDark(apply(prefs));
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [prefs]);

  const setPrefs = useCallback((p: Partial<ThemePrefs>) => {
    setState(prev => {
      const next = { ...prev, ...p };
      localStorage.setItem(KEY, JSON.stringify(next));
      if (signedIn) saveTheme({ data: next }).catch(() => {});
      return next;
    });
  }, [signedIn, saveTheme]);

  return <ThemeCtx.Provider value={{ prefs, dark, setPrefs }}>{children}</ThemeCtx.Provider>;
}
