// The audit log as a readable timeline — what an investigator reads after an incident.

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

const ACTION: Record<string, { label: string; dot: string }> = {
  CREATED: { label: "Raised the permit", dot: "bg-slate-400" },
  SUBMITTED: { label: "Submitted for approval", dot: "bg-amber-500" },
  APPROVED: { label: "Approved", dot: "bg-blue-600" },
  REJECTED: { label: "Rejected", dot: "bg-red-700" },
  STATUS_CHANGED: { label: "Status changed", dot: "bg-slate-600" },
  FIELD_CHANGED: { label: "Changed a field", dot: "bg-violet-600" },
  ACTIVATED: { label: "Started work (activated)", dot: "bg-green-700" },
  SUSPENDED: { label: "STOPPED WORK (suspended)", dot: "bg-red-700" },
  AUTO_SUSPENDED: { label: "Work auto-suspended — unsafe reading", dot: "bg-red-700" },
  RESUMED: { label: "Resumed work", dot: "bg-green-700" },
  CLOSED: { label: "Closed — work complete", dot: "bg-teal-600" },
  VERIFIED: { label: "Verified area & closed out", dot: "bg-slate-900" },
  CANCELLED: { label: "Cancelled", dot: "bg-slate-500" },
  EXPIRED: { label: "Permit expired", dot: "bg-slate-700" },
  EXTENSION_REQUESTED: { label: "Requested an extension", dot: "bg-blue-400" },
  EXTENSION_APPROVED: { label: "Approved extension", dot: "bg-blue-600" },
  EXTENSION_REJECTED: { label: "Refused extension", dot: "bg-red-600" },
};

function pretty(field: string | null, v: string | null): string {
  if (v === null) return "—";
  if (field === "status" && v in STATUS_LABELS) return STATUS_LABELS[v as PermitStatus];
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
    <ol className="relative space-y-4 border-l-2 border-slate-200 pl-6">
      {entries.map((e) => {
        const a = ACTION[e.action] ?? { label: e.action, dot: "bg-slate-400" };
        const label = fieldLabel(e.field);
        const showChange = e.fromValue !== null || (e.toValue !== null && e.action !== "CREATED");
        return (
          <li key={e.id} className="relative">
            <span className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full ring-4 ring-white ${a.dot}`} aria-hidden />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-bold">{a.label}</span>
              <span className="text-sm text-slate-600">
                by {e.actor ? `${e.actor.name} (${ROLE_LABELS[e.actor.role as Role]})` : "System"}
              </span>
            </div>
            <time className="block font-mono text-xs text-slate-500" dateTime={e.createdAt.toISOString()}>
              {formatDateTime(e.createdAt)} IST
            </time>
            {showChange && (
              <p className="mt-1 text-sm">
                {label && <span className="font-semibold">{label}: </span>}
                <span className="rounded bg-slate-100 px-1 line-through decoration-slate-400">{pretty(e.field, e.fromValue)}</span> →{" "}
                <span className="rounded bg-slate-900 px-1 font-semibold text-white">{pretty(e.field, e.toValue)}</span>
              </p>
            )}
            {e.comment && <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-2 text-sm text-slate-800 ring-1 ring-slate-200">“{e.comment}”</p>}
          </li>
        );
      })}
    </ol>
  );
}
