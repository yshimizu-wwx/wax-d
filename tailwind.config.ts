import type { Config } from "tailwindcss";

/** Tech-Noir / Precision SaaS (Linear/Vercel inspired) */
const tokens = {
  background: "#09090b",   // Zinc-950
  foreground: "#fafafa",   // Zinc-50
  card: "#18181b",         // Zinc-900
  "card-foreground": "#fafafa",
  primary: "#3b82f6",      // Blue-500
  "primary-foreground": "#ffffff",
  muted: "#27272a",        // Zinc-800
  "muted-foreground": "#a1a1aa", // Zinc-400
  border: "#27272a",       // Zinc-800
  accent: "#27272a",
  "accent-foreground": "#fafafa",
};

/** Dashboard / app chrome uses same dark palette (semantic alias) */
const dashboardColors = {
  bg: tokens.background,
  card: tokens.card,
  text: tokens.foreground,
  muted: tokens["muted-foreground"],
  border: tokens.border,
};

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        agrix: {
          forest: tokens.primary,
          "forest-light": "#60a5fa",
          "forest-dark": "#2563eb",
          gold: tokens["muted-foreground"],
          "gold-light": "#d4d4d8",
          "gold-dark": "#71717a",
          slate: tokens.muted,
        },
        dashboard: {
          bg: dashboardColors.bg,
          card: dashboardColors.card,
          text: dashboardColors.text,
          muted: dashboardColors.muted,
          border: dashboardColors.border,
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        mono: ["var(--font-noto-sans-jp)", "monospace"],
      },
      letterSpacing: {
        tight: "-0.025em",
        tighter: "-0.05em",
      },
      animation: {
        "price-pulse": "price-pulse 0.6s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
      },
      keyframes: {
        "price-pulse": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.05)", opacity: "0.9" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
} satisfies Config;
