import { STATUS_LABELS, type PermitStatus } from "@/domain/enums";
import { getPermitType } from "@/domain/permit-types";
import { STATUS_META, typeIcon } from "./icons";

// Status is the only coloured thing on a row, and never colour alone: every
// badge has an icon and a label. ACTIVE and SUSPENDED are solid because they
// are the two states someone on site must notice from arm's length.
const TONE: Record<string, string> = {
  neutral: "bg-white text-ink-2 border-line-strong",
  info: "bg-info-soft text-info border-info-line",
  warning: "bg-warning-soft text-warning border-warning-line",
  good: "bg-good text-white border-good",
  critical: "bg-critical text-white border-critical",
  done: "bg-ink text-white border-ink",
  muted: "bg-ground-alt text-ink-muted border-line",
};

export function StatusBadge({ status, large }: { status: PermitStatus; large?: boolean }) {
  const { icon: Icon, tone } = STATUS_META[status];
  const quiet = status === "REJECTED"; // rejected: red text on a soft ground, not a solid alarm
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold ${
        quiet ? "border-critical-line bg-critical-soft text-critical" : TONE[tone]
      } ${large ? "px-3.5 py-1.5 text-base" : "px-2.5 py-0.5 text-[13px]"}`}
    >
      <Icon aria-hidden className={large ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"} strokeWidth={2.25} />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Permit type: neutral, identified by icon + name (colour is reserved for status). */
export function TypeBadge({ type, short }: { type: string; short?: boolean }) {
  const def = getPermitType(type);
  const Icon = typeIcon(type);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-ground px-2.5 py-0.5 text-[13px] font-semibold text-ink-2">
      <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
      {short ? def?.shortLabel : def?.label ?? type}
    </span>
  );
}
