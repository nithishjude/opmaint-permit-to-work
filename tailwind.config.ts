import type { Config } from "tailwindcss";

// One system, in the Opmaint product language: forest-green ink, lime accent,
// pale green-grey ground, sky-to-sand gradient for hero bands. The interface is
// ~90% neutral; colour is
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
        // Opmaint forest green: sidebar, ink, primary buttons.
        navy: { DEFAULT: "#163300", deep: "#0f2600", soft: "#24470d" },
        ink: { DEFAULT: "#163300", 2: "#2f4a22", muted: "#566a56", faint: "#7a8c7a" },
        ground: { DEFAULT: "#f3f7f3", alt: "#e5ede5" },
        line: { DEFAULT: "rgba(22,51,0,0.12)", strong: "rgba(22,51,0,0.26)" },
        // Primary action = dark green with a lime label (Opmaint's button).
        action: { DEFAULT: "#163300", hover: "#0f2600", soft: "#e9f7dd" },
        lime: { DEFAULT: "#a0f663", soft: "#e4fbd2", dot: "#98f556" },
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
