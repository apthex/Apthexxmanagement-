import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--apt-ink, #121215)",
          light: "#121215",
          dark: "#F4F4F6",
        },
        paper: {
          DEFAULT: "var(--apt-surface, #FFFFFF)",
          light: "#FFFFFF",
          dark: "#131318",
        },
        wash: {
          DEFAULT: "var(--apt-bg, #F7F6F2)",
          light: "#F7F6F2",
          dark: "#0B0B0E",
        },
        line: {
          DEFAULT: "var(--apt-line, rgba(23,23,27,0.08))",
          light: "rgba(23,23,27,0.08)",
          dark: "rgba(255,255,255,0.08)",
        },
        muted: {
          DEFAULT: "var(--apt-muted, #71717A)",
          light: "#71717A",
          dark: "#93939F",
        },
        red: {
          DEFAULT: "#E11D2E",
          dark: "#B51424",
          light: "#FFF1F2",
          glow: "rgba(225, 29, 46, 0.15)",
        },
        ok: "#157B41",
        warn: "#9A6400",
        info: "#2355B8",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(23,23,27,0.04), 0 1px 2px rgba(23,23,27,0.02)",
        float: "0 16px 48px rgba(10,10,14,0.18)",
        "glass-sm": "0 1px 2px 0 rgba(0, 0, 0, 0.03), inset 0 1px 0 0 rgba(255, 255, 255, 0.6)",
        "glass-md": "0 4px 16px -2px rgba(0, 0, 0, 0.04), inset 0 1px 0 0 rgba(255, 255, 255, 0.7)",
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
    },
  },
  plugins: [],
};

export default config;
