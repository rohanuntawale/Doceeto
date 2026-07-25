/**
 * Color themes. Each one only swaps the RGB-triplet CSS variables in
 * app/globals.css (via a data-theme attribute on <html>), so the whole
 * app reskins with no component changes. All four keep the calm,
 * Japanese-inspired feel; they differ in shell and accent.
 */
// Single product skin — the Doceeto brand: warm cream/beige glassmorphism,
// terracotta + sage-green accents.
export const THEMES = [
  { id: "doceeto", name: "Doceeto", jp: "", hint: "Cream glass", accent: "#C0692F", bg: "#F0E9DA" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

// v6: default flipped to the light Doceeto brand skin.
export const THEME_KEY = "iyashi:theme:v6";
export const DEFAULT_THEME: ThemeId = "doceeto";

/** Runs before paint (inlined in <head>) so there is no theme flash. */
export const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
