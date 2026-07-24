import type { Config } from "tailwindcss";

/**
 * Doceeto design system. Colors are exposed as CSS-variable RGB triplets
 * in app/globals.css so each data-theme can remap them; Tailwind consumes
 * them via rgb(var(--x) / <alpha-value>) which keeps /opacity modifiers.
 */
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // All brand hues resolve through CSS variables (RGB triplets set
        // per theme in app/globals.css), so switching data-theme reskins
        // the whole app and Tailwind opacity modifiers (bg-terracotta/12)
        // keep working.
        espresso: {
          DEFAULT: v("--c-espresso"),
          800: v("--c-espresso-800"),
          700: v("--c-espresso-700"),
          600: v("--c-espresso-600"),
        },
        cream: v("--c-cream"),
        sand: v("--c-sand"),
        tan: v("--c-tan"),
        terracotta: {
          DEFAULT: v("--c-terracotta"),
          700: v("--c-terracotta-700"),
          300: v("--c-terracotta-300"),
        },
        salmon: v("--c-salmon"),
        ink: v("--c-ink"),
        // Text/icon color that sits ON the accent (buttons, SOS, chips).
        // Cream in the dark-accent themes; deep green in Mori's white accent.
        "on-accent": v("--c-on-accent"),
        // Functional status hues, harmonized with the brand.
        status: {
          critical: v("--c-status-critical"),
          warn: v("--c-status-warn"),
          ok: v("--c-status-ok"),
          idle: v("--c-status-idle"),
        },
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
        jp: ["var(--font-jp)", "Noto Sans JP", "sans-serif"],
      },
      letterSpacing: {
        label: "0.15em",
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 30px rgba(0,0,0,0.28)",
        glow: "0 0 0 1px rgb(var(--c-terracotta) / 0.5), 0 0 28px rgb(var(--c-terracotta) / 0.35)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgb(var(--c-terracotta) / 0.55)" },
          "70%": { boxShadow: "0 0 0 14px rgb(var(--c-terracotta) / 0)" },
          "100%": { boxShadow: "0 0 0 0 rgb(var(--c-terracotta) / 0)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "rise": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        "sheen": {
          "0%": { transform: "translateX(-120%) skewX(-12deg)", opacity: "0" },
          "20%": { opacity: "0.5" },
          "60%, 100%": { transform: "translateX(220%) skewX(-12deg)", opacity: "0" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-up": "fade-up 0.28s ease-out both",
        "rise": "rise 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "float": "float 9s ease-in-out infinite",
        "sheen": "sheen 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
