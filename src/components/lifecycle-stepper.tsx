// Where this permit is in its life, at a glance: the happy path as six steps,
// with the off-path states (suspended, rejected, expired, cancelled) shown
// where they interrupted it.

import { Ban, Check, CircleX, OctagonPause, TimerOff, type LucideIcon } from "lucide-react";
import type { PermitStatus } from "@/domain/enums";
import { formatDateTime } from "@/lib/time";

interface Props {
  status: PermitStatus;
  createdAt: Date;
  submittedAt: Date | null;
  approvedAt: Date | null;
  activatedAt: Date | null;
  closedAt: Date | null;
  verifiedAt: Date | null;
}

const REACHED: Record<PermitStatus, number> = {
  DRAFT: 0,
  PENDING_APPROVAL: 1,
  APPROVED: 2,
  ACTIVE: 3,
  SUSPENDED: 3,
  CLOSED: 4,
  CLOSED_VERIFIED: 5,
  REJECTED: 1,
  EXPIRED: -1,
  CANCELLED: -1,
};

export function LifecycleStepper(p: Props) {
  const steps = [
    { label: "Raised", at: p.createdAt },
    { label: "Submitted", at: p.submittedAt },
    { label: "Approved", at: p.approvedAt },
    { label: "Work started", at: p.activatedAt },
    { label: "Closed", at: p.closedAt },
    { label: "Verified", at: p.verifiedAt },
  ];
  // For expired/cancelled, the last step that actually has a timestamp.
  let reached = REACHED[p.status];
  if (reached < 0) reached = steps.reduce((r, s, i) => (s.at ? i : r), 0);

  // The step where the permit left the happy path, if it did.
  const interrupt: { at: number; label: string; icon: LucideIcon; tone: string } | null =
    p.status === "SUSPENDED"
      ? { at: 3, label: "Work stopped", icon: OctagonPause, tone: "critical" }
      : p.status === "REJECTED"
        ? { at: 2, label: "Rejected", icon: CircleX, tone: "critical" }
        : p.status === "EXPIRED"
          ? { at: reached + 1, label: "Expired", icon: TimerOff, tone: "muted" }
          : p.status === "CANCELLED"
            ? { at: reached + 1, label: "Cancelled", icon: Ban, tone: "muted" }
            : null;
  const current = interrupt ? interrupt.at : reached;

  return (
    <ol className="grid grid-cols-6" aria-label="Permit lifecycle">
      {steps.map((s, i) => {
        const done = i < current || (!interrupt && i === current && p.status === "CLOSED_VERIFIED");
        const isCurrent = i === current;
        const isInterrupt = interrupt && i === interrupt.at;
        const after = i > current;
        const Icon = isInterrupt ? interrupt.icon : Check;
        const dot = isInterrupt
          ? interrupt.tone === "critical"
            ? "border-critical bg-critical text-white"
            : "border-ink-muted bg-ink-muted text-white"
          : done
            ? "border-action bg-action text-lime"
            : isCurrent
              ? "border-action bg-white text-action ring-4 ring-action/15"
              : "border-line-strong bg-white text-ink-faint";
        const label = isInterrupt ? interrupt.label : s.label;
        return (
          <li key={s.label} className="relative flex flex-col items-center text-center" aria-current={isCurrent ? "step" : undefined}>
            {i > 0 && (
              <span aria-hidden className={`absolute right-1/2 top-[13px] h-0.5 w-full ${i <= current ? "bg-action" : "bg-line-strong"} ${after ? "opacity-60" : ""}`} />
            )}
            <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 ${dot}`}>
              {done || isInterrupt ? <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={3} /> : <span className={`h-2 w-2 rounded-full ${isCurrent ? "bg-action" : "bg-line-strong"}`} />}
            </span>
            <span className={`mt-2 text-[12px] font-semibold leading-tight sm:text-[13px] ${isInterrupt ? (interrupt.tone === "critical" ? "text-critical" : "text-ink-muted") : after ? "text-ink-faint" : "text-ink"}`}>{label}</span>
            <span className="mt-0.5 hidden font-mono text-[12px] text-ink-muted sm:block">{s.at && !isInterrupt && !after ? formatDateTime(s.at) : " "}</span>
          </li>
        );
      })}
    </ol>
  );
}
