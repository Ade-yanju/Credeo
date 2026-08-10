import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vodium brand tokens
        vodium: {
          black: "#0A0A0A",
          gold: "#C9A961",
          "gold-soft": "#E5C97D",
          cream: "#FAFAF7",
          charcoal: "#1F1F1F",
          slate: "#2A2A2A",
        },
        success: "#16A34A",
        warning: "#D97706",
        danger: "#DC2626",
        // shadcn-friendly tokens (mapped to Vodium)
        background: "#FAFAF7",
        foreground: "#0A0A0A",
        primary: {
          DEFAULT: "#0A0A0A",
          foreground: "#FAFAF7",
        },
        accent: {
          DEFAULT: "#C9A961",
          foreground: "#0A0A0A",
        },
        muted: {
          DEFAULT: "#F0EFEA",
          foreground: "#5A5A5A",
        },
        border: "#E5E2D9",
      },
      fontFamily: {
        // Inter sits between Playfair and the generic serif on purpose:
        // Playfair has no ₦ (U+20A6), and CSS resolves font fallback per
        // glyph, so a Naira amount inside a serif header renders in Inter
        // instead of dropping to Times. Keep this in sync with the
        // `.font-serif` rule in globals.css.
        serif: [
          "var(--font-playfair)",
          "Playfair Display",
          "var(--font-inter)",
          "Inter",
          "serif",
        ],
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "4px",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(200%)" },
        },
        spotlight: {
          "0%": { opacity: "0", transform: "translate(-72%, -62%) scale(0.5)" },
          "100%": { opacity: "1", transform: "translate(-50%, -40%) scale(1)" },
        },
      },
      animation: {
        shimmer: "shimmer 2s linear infinite",
        spotlight: "spotlight 2s ease 0.75s 1 forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
