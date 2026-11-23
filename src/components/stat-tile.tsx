import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Tone = "good" | "warning" | "critical" | "info" | "neutral";

const ICON_TONE: Record<Tone, string> = {
  good: "bg-good-soft text-good",
  warning: "bg-warning-soft text-warning",
  critical: "bg-critical-soft text-critical",
  info: "bg-info-soft text-info",
  neutral: "bg-ground text-ink-muted",
};
const RULE_TONE: Record<Tone, string> = {
  good: "before:bg-good",
  warning: "before:bg-warning-fill",
  critical: "before:bg-critical",
  info: "before:bg-info",
  neutral: "before:bg-transparent",
};

/**
 * KPI tile: label (sentence case), value in ink (never in the status colour),
 * status carried by an icon + a top rule — and only when the count needs
 * attention, so a quiet site reads as a quiet dashboard.
 */
export function StatTile({ href, label, value, icon: Icon, tone, hint }: { href: string; label: string; value: number; icon: LucideIcon; tone: Tone; hint?: string }) {
  const lit = value > 0 ? tone : "neutral";
  return (
    <Link
      href={href}
      className={`card-link relative overflow-hidden p-4 before:absolute before:inset-x-0 before:top-0 before:h-1 ${RULE_TONE[lit]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-h-[40px] text-[14px] font-medium leading-snug text-ink-2">{label}</span>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm ${ICON_TONE[lit]}`}>
          <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </span>
      </div>
      <div className="mt-3 text-[40px] font-semibold leading-none tracking-tight tabular-nums text-ink">{value}</div>
      {hint && <div className="mt-2 text-[13px] text-ink-muted">{hint}</div>}
    </Link>
  );
}
