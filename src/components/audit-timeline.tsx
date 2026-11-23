// The audit log as a readable timeline — what an investigator reads after an incident.

import {
  ArrowRight,
  BadgeCheck,
  Ban,
  CheckCheck,
  CircleX,
  FilePlus,
  OctagonPause,
  PencilLine,
  Play,
  Send,
  ShieldCheck,
  TimerOff,
  TimerReset,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { ROLE_LABELS, STATUS_LABELS, type PermitStatus, type Role } from "@/domain/enums";
import { formatDateTime } from "@/lib/time";

interface Entry {
  id: string;
  action: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  comment: string | null;
  createdAt: Date;
  actor: { name: string; role: string } | null;
}

type Tone = "neutral" | "good" | "critical" | "info" | "warning";
const ACTION: Record<string, { label: string; icon: LucideIcon; tone: Tone }> = {
  CREATED: { label: "Raised the permit", icon: FilePlus, tone: "neutral" },
  SUBMITTED: { label: "Submitted for approval", icon: Send, tone: "warning" },
  APPROVED: { label: "Signed — approved", icon: BadgeCheck, tone: "info" },
  REJECTED: { label: "Rejected", icon: CircleX, tone: "critical" },
  STATUS_CHANGED: { label: "Status changed", icon: RefreshCw, tone: "neutral" },
  FIELD_CHANGED: { label: "Changed a field", icon: PencilLine, tone: "neutral" },
  ACTIVATED: { label: "Started work", icon: Play, tone: "good" },
  SUSPENDED: { label: "Stopped work", icon: OctagonPause, tone: "critical" },
  AUTO_SUSPENDED: { label: "Work stopped automatically — unsafe reading", icon: OctagonPause, tone: "critical" },
  RESUMED: { label: "Resumed work", icon: Play, tone: "good" },
  CLOSED: { label: "Closed — work complete", icon: CheckCheck, tone: "info" },
  VERIFIED: { label: "Verified the area and closed out", icon: ShieldCheck, tone: "good" },
  CANCELLED: { label: "Cancelled", icon: Ban, tone: "neutral" },
  EXPIRED: { label: "Permit expired", icon: TimerOff, tone: "neutral" },
  EXTENSION_REQUESTED: { label: "Requested an extension", icon: TimerReset, tone: "info" },
  EXTENSION_APPROVED: { label: "Approved the extension", icon: TimerReset, tone: "good" },
  EXTENSION_REJECTED: { label: "Refused the extension", icon: TimerReset, tone: "critical" },
};
const DOT: Record<Tone, string> = {
  neutral: "bg-white text-ink-muted border-line-strong",
  good: "bg-good-soft text-good border-good-line",
  critical: "bg-critical-soft text-critical border-critical-line",
  info: "bg-info-soft text-info border-info-line",
  warning: "bg-warning-soft text-warning border-warning-line",
};

function pretty(field: string | null, v: string | null): string {
  if (v === null) return "—";
  if (field === "status" && v in STATUS_LABELS) return STATUS_LABELS[v as PermitStatus];
  if (field?.startsWith("approval.")) return v.charAt(0) + v.slice(1).toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDateTime(v);
  return v;
}

function fieldLabel(field: string | null): string | null {
  if (!field || field === "status") return null;
  if (field.startsWith("approval.")) return `${ROLE_LABELS[field.slice(9) as Role] ?? field.slice(9)} sign-off`;
  if (field === "validUntil") return "Valid until";
  return field;
}

export function AuditTimeline({ entries }: { entries: Entry[] }) {
  return (
    <ol className="relative">
      {entries.map((e, i) => {
        const a = ACTION[e.action] ?? { label: e.action, icon: RefreshCw, tone: "neutral" as Tone };
        const Icon = a.icon;
        const label = fieldLabel(e.field);
        const showChange = e.fromValue !== null || (e.toValue !== null && e.action !== "CREATED");
        return (
          <li key={e.id} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i < entries.length - 1 && <span aria-hidden className="absolute bottom-0 left-[15px] top-8 w-px bg-line-strong" />}
            <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${DOT[a.tone]}`}>
              <Icon aria-hidden className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{a.label}</span>
                <span className="text-[14px] text-ink-muted">
                  {e.actor ? `${e.actor.name} · ${ROLE_LABELS[e.actor.role as Role]}` : "System"}
                </span>
              </div>
              <time className="block font-mono text-[13px] text-ink-muted" dateTime={e.createdAt.toISOString()}>
                {formatDateTime(e.createdAt)} IST
              </time>
              {showChange && (
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[14px]">
                  {label && <span className="font-semibold">{label}</span>}
                  <span className="rounded-sm bg-ground px-1.5 py-0.5 text-ink-muted line-through decoration-ink-faint">{pretty(e.field, e.fromValue)}</span>
                  <ArrowRight aria-label="changed to" className="h-3.5 w-3.5 text-ink-faint" />
                  <span className="rounded-sm bg-ink px-1.5 py-0.5 font-semibold text-white">{pretty(e.field, e.toValue)}</span>
                </p>
              )}
              {e.comment && <p className="mt-2 whitespace-pre-line border-l-2 border-line-strong pl-3 text-[15px] text-ink-2">{e.comment}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
