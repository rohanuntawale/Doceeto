import type { Config } from "tailwindcss";

/**
 * Iyashi design system — tokens sourced from the pitch deck.
 * Colors are exposed as CSS variables in app/globals.css so light/dark
 * surfaces can remap them; Tailwind consumes them via rgb(var(--x)).
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        espresso: {
          DEFAULT: "#2A2320",
          800: "#342C26",
          700: "#3F352E",
          600: "#4A3F37",
        },
        cream: "#F1E9D8",
        sand: "#D9C9A8",
        tan: "#C9A876",
        terracotta: {
          DEFAULT: "#C15A38",
          700: "#A94E30",
          300: "#E0A890",
        },
        salmon: "#E0A890",
        ink: "#2A2320",
        // Functional status hues, harmonized with the brand.
        status: {
          critical: "#C15A38",
          warn: "#C9A876",
          ok: "#7C8B63",
          idle: "#6B615A",
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
        card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 30px rgba(0,0,0,0.25)",
        glow: "0 0 0 1px rgba(193,90,56,0.5), 0 0 28px rgba(193,90,56,0.35)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(193,90,56,0.55)" },
          "70%": { boxShadow: "0 0 0 14px rgba(193,90,56,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(193,90,56,0)" },
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
