import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type ThemePref = "system" | "light" | "dark";
export type AccentPref = "windows" | "fluent";

type SystemLook = { accent: string | null; mica: boolean };

const THEME_KEY = "delta.theme";
const ACCENT_KEY = "delta.accent";
const FLUENT_BLUE = "#0067c0";

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {}
  return "system";
}

function readAccentPref(): AccentPref {
  try {
    if (localStorage.getItem(ACCENT_KEY) === "fluent") return "fluent";
  } catch {}
  return "windows";
}

function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return (
    "#" +
    [r, g, b]
      .map((c) => Math.round(c).toString(16).padStart(2, "0"))
      .join("")
  );
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Derivă variantele accentului din culoarea de bază și le setează inline pe <html>,
 * peste valorile din styles.css. Textul de pe accent e negru sau alb după luminanță.
 */
export function applyAccent(base: string, dark: boolean) {
  const surface = dark ? "#202020" : "#ffffff";
  const toward = dark ? "#ffffff" : "#000000";
  const s = document.documentElement.style;
  s.setProperty("--color-accent", base);
  s.setProperty("--color-accent-hover", mix(base, toward, 0.1));
  s.setProperty("--color-accent-pressed", mix(base, toward, 0.25));
  s.setProperty("--color-accent-fg", dark ? mix(base, "#ffffff", 0.2) : base);
  s.setProperty("--color-accent-subtle", mix(surface, base, dark ? 0.2 : 0.12));
  s.setProperty("--color-on-accent", luminance(base) > 0.4 ? "#000000" : "#ffffff");
}

/**
 * Tema (sistem / luminos / întunecat) și accentul (Windows / Fluent). Aplică
 * data-theme pe <html>, reacționează la tema sistemului și la schimbarea
 * accentului din Windows (citit la fiecare focus al ferestrei).
 */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readPref);
  const [accentPref, setAccentPref] = useState<AccentPref>(readAccentPref);
  const [look, setLook] = useState<SystemLook>({ accent: null, mica: false });
  const [dark, setDark] = useState<boolean>(() =>
    pref === "dark" || (pref === "system" && systemDark()),
  );

  useEffect(() => {
    invoke<SystemLook>("system_look")
      .then(setLook)
      .catch(() => {});
    const onFocus = () => {
      invoke<SystemLook>("system_look")
        .then(setLook)
        .catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    const resolve = () => {
      const isDark = pref === "dark" || (pref === "system" && systemDark());
      setDark(isDark);
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
    };
    resolve();
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", resolve);
    return () => mq.removeEventListener("change", resolve);
  }, [pref]);

  useEffect(() => {
    const base =
      accentPref === "windows" && look.accent ? look.accent : FLUENT_BLUE;
    applyAccent(base, dark);
  }, [accentPref, look.accent, dark]);

  const choose = useCallback((next: ThemePref) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    setPref(next);
  }, []);

  const chooseAccent = useCallback((next: AccentPref) => {
    try {
      localStorage.setItem(ACCENT_KEY, next);
    } catch {}
    setAccentPref(next);
  }, []);

  return { pref, dark, choose, accentPref, chooseAccent, look };
}
