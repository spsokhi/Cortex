import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Core backgrounds
        "cortex-bg": "#09090b",
        "cortex-surface": "#111113",
        "cortex-surface-2": "#18181b",
        "cortex-surface-3": "#27272a",
        // Borders
        "cortex-border": "#27272a",
        "cortex-border-subtle": "#1e1e23",
        // Text
        "cortex-text": "#fafafa",
        "cortex-text-muted": "#a1a1aa",
        "cortex-text-dim": "#52525b",
        // Accent (indigo-based)
        "cortex-accent": "#818cf8",
        "cortex-accent-dim": "#4f46e5",
        "cortex-accent-glow": "rgba(129, 140, 248, 0.15)",
        // Status colors
        "cortex-success": "#4ade80",
        "cortex-warning": "#fbbf24",
        "cortex-error": "#f87171",
        "cortex-info": "#60a5fa",
        // User message bubble
        "cortex-user-bg": "#1e1b4b",
        "cortex-user-border": "#3730a3",
      },
      fontFamily: {
        sans: ["Inter var", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Cascadia Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        shimmer: "shimmer 2s infinite",
        "spin-slow": "spin 3s linear infinite",
        blink: "blink 1s step-end infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(8px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "cortex-grid":
          "linear-gradient(rgba(39,39,42,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(39,39,42,0.4) 1px, transparent 1px)",
        shimmer:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
      },
      backgroundSize: {
        "cortex-grid": "32px 32px",
      },
      boxShadow: {
        "cortex-sm": "0 0 0 1px rgba(129, 140, 248, 0.1)",
        "cortex-md":
          "0 0 0 1px rgba(129, 140, 248, 0.2), 0 4px 16px rgba(0,0,0,0.4)",
        "cortex-lg":
          "0 0 0 1px rgba(129, 140, 248, 0.15), 0 8px 32px rgba(0,0,0,0.6)",
        "cortex-glow": "0 0 24px rgba(129, 140, 248, 0.15)",
      },
      transitionTimingFunction: {
        "cortex-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
