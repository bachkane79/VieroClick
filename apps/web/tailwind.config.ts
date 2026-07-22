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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
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
        soft: "rgba(15,15,15,0.012) 0 0.2px 1px, rgba(15,15,15,0.02) 0 1px 3px, rgba(15,15,15,0.028) 0 4px 12px",
        elevated:
          "rgba(15,15,15,0.02) 0 1px 3px, rgba(15,15,15,0.04) 0 8px 22px, rgba(15,15,15,0.05) 0 22px 48px",
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
