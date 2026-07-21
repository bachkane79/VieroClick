import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: {
          DEFAULT: "hsl(var(--border))",
          strong: "hsl(var(--border-strong))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        "focus-ring": "hsl(var(--focus-ring))",
        background: "hsl(var(--background))",
        canvas: "hsl(var(--canvas))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          subtle: "hsl(var(--surface-subtle))",
          hover: "hsl(var(--surface-hover))",
        },
        foreground: "hsl(var(--foreground))",
        "text-secondary": "hsl(var(--text-secondary))",
        "text-disabled": "hsl(var(--text-disabled))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        ai: {
          DEFAULT: "hsl(var(--ai))",
          foreground: "hsl(var(--ai-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
          soft: "hsl(var(--brand-soft))",
        },
        // Pastel accent family (redesign §3.4). `<name>` = accent, `<name>-soft`
        // = surface tint. e.g. bg-coral-soft text-coral.
        coral: { DEFAULT: "hsl(var(--coral))", soft: "hsl(var(--coral-soft))" },
        peach: { DEFAULT: "hsl(var(--peach))", soft: "hsl(var(--peach-soft))" },
        lavender: { DEFAULT: "hsl(var(--lavender))", soft: "hsl(var(--lavender-soft))" },
        sky: { DEFAULT: "hsl(var(--sky))", soft: "hsl(var(--sky-soft))" },
        mint: { DEFAULT: "hsl(var(--mint))", soft: "hsl(var(--mint-soft))" },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        soft: "rgba(16,24,40,0.03) 0 1px 2px, rgba(16,24,40,0.04) 0 2px 6px",
        elevated: "rgba(16,24,40,0.06) 0 4px 12px, rgba(16,24,40,0.08) 0 12px 28px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
