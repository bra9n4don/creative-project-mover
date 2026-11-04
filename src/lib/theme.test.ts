import { describe, expect, it } from "vitest";
import { isDark, parseTheme } from "./theme";

describe("theme prefs", () => {
  it("falls back to dark ember for missing or invalid saved values", () => {
    expect(parseTheme(null)).toEqual({ mode: "dark", palette: "ember" });
    expect(parseTheme({ mode: "neon", palette: "ocean" })).toEqual({ mode: "dark", palette: "ember" });
  });
  it("keeps a valid saved choice", () => {
    expect(parseTheme({ mode: "light", palette: "forest" })).toEqual({ mode: "light", palette: "forest" });
  });
  it("system mode follows the device", () => {
    expect(isDark("system", true)).toBe(true);
    expect(isDark("system", false)).toBe(false);
    expect(isDark("light", true)).toBe(false);
  });
});
