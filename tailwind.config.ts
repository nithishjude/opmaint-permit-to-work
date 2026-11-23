import type { Config } from "tailwindcss";

// One system: corporate CMMS look — navy header, cool grey ground, blue-teal
// accent. The interface is ~90% neutral; colour is
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
        navy: { DEFAULT: "#0b2545", deep: "#071a33", soft: "#13315c" },
        ink: { DEFAULT: "#1b2a3a", 2: "#33475b", muted: "#586879", faint: "#8796a5" },
        ground: { DEFAULT: "#f5f7fa", alt: "#e8edf3" },
        line: { DEFAULT: "rgba(27,42,58,0.12)", strong: "rgba(27,42,58,0.26)" },
        // Blue-teal, deliberately bluer than the status green so the main
        // button never reads as "safe to start". White on it is 5.4:1.
        action: { DEFAULT: "#0e7490", hover: "#155e75", soft: "#e3f2f6" },
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
