/**
 * Color themes. Each one only swaps the RGB-triplet CSS variables in
 * app/globals.css (via a data-theme attribute on <html>), so the whole
 * app reskins with no component changes. All four keep the calm,
 * Japanese-inspired feel; they differ in shell and accent.
 */
export const THEMES = [
  // Brand default — the Investor Brief 2026 palette: deep forest green,
  // paper text, WHITE accent (CTAs/SOS), gold for highlights.
  { id: "mori", name: "Mori", jp: "森", hint: "Forest & white", accent: "#FFFFFF", bg: "#173029" },
  { id: "sumi", name: "Sumi", jp: "墨", hint: "Espresso", accent: "#C15A38", bg: "#2A2320" },
  { id: "matcha", name: "Matcha", jp: "抹茶", hint: "Tea green", accent: "#C9A24B", bg: "#1E251D" },
  { id: "sakura", name: "Sakura", jp: "桜", hint: "Blossom", accent: "#D96A8A", bg: "#241E24" },
  { id: "ai", name: "Ai", jp: "藍", hint: "Indigo", accent: "#7C8CF0", bg: "#191F2D" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

// v2: default flipped to the investor-brief "mori" palette.
export const THEME_KEY = "iyashi:theme:v2";
export const DEFAULT_THEME: ThemeId = "mori";

/** Runs before paint (inlined in <head>) so there is no theme flash. */
export const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
