import type { Config } from "tailwindcss";

// One system. The interface is ~90% neutral (ink on a warm ground); colour is
// reserved for permit *status* (good / warning / critical / info), always paired
// with an icon and a label, and one accent (`action`) for the main button,
// links and focus. Never violet.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Consolas", "monospace"],
      },
      colors: {
        ink: { DEFAULT: "#1c1b19", 2: "#3a3833", muted: "#5f5c55", faint: "#8a867d" },
        ground: { DEFAULT: "#f4f3ef", alt: "#ebe9e3" },
        line: { DEFAULT: "rgba(28,27,25,0.13)", strong: "rgba(28,27,25,0.28)" },
        action: { DEFAULT: "#1452c4", hover: "#103f98", soft: "#e8effb" },
        good: { DEFAULT: "#15803d", soft: "#e8f4ec", line: "#9fd0b0" },
        warning: { DEFAULT: "#a35200", fill: "#f5a524", soft: "#fdf3e2", line: "#efc27a" },
        critical: { DEFAULT: "#b42318", soft: "#fcebe9", line: "#f0a8a1" },
        info: { DEFAULT: "#1d4ed8", soft: "#e9effd", line: "#a9bff3" },
      },
      borderRadius: { sm: "8px", md: "12px", lg: "16px" },
      fontSize: {
        label: ["13px", { lineHeight: "18px", fontWeight: "500" }],
      },
      transitionTimingFunction: { ui: "cubic-bezier(.2,.8,.2,1)" },
      transitionDuration: { in: "140ms", out: "200ms", press: "90ms" },
    },
  },
  plugins: [],
} satisfies Config;
