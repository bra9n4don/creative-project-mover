import { z } from "zod";

export const PALETTES = [
  { id: "ember", label: "Ember", swatch: "hsl(12 78% 52%)" },
  { id: "ocean", label: "Ocean", swatch: "hsl(204 80% 46%)" },
  { id: "forest", label: "Forest", swatch: "hsl(152 55% 36%)" },
  { id: "violet", label: "Violet", swatch: "hsl(266 60% 56%)" },
  { id: "amber", label: "Amber", swatch: "hsl(38 92% 48%)" },
] as const;
export const MODES = ["light", "dark", "system"] as const;

export const themePrefsSchema = z.object({
  mode: z.enum(MODES),
  palette: z.enum(PALETTES.map(p => p.id) as [string, ...string[]]),
});
export type ThemePrefs = z.infer<typeof themePrefsSchema>;
export const DEFAULT_THEME: ThemePrefs = { mode: "dark", palette: "ember" };

/** Accepts anything stored; falls back to defaults for unknown or broken values. */
export function parseTheme(v: unknown): ThemePrefs {
  const r = themePrefsSchema.safeParse(v);
  return r.success ? r.data : DEFAULT_THEME;
}

export function isDark(mode: ThemePrefs["mode"], systemDark: boolean) {
  return mode === "dark" || (mode === "system" && systemDark);
}
