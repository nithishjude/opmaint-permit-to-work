import { STATUS_LABELS, type PermitStatus } from "@/domain/enums";
import { getPermitType } from "@/domain/permit-types";

// Colour is never the only signal: every status also has a text label and an icon.
const STATUS_STYLE: Record<PermitStatus, { cls: string; icon: string }> = {
  DRAFT: { cls: "bg-slate-100 text-slate-700 ring-slate-300", icon: "✎" },
  PENDING_APPROVAL: { cls: "bg-amber-100 text-amber-900 ring-amber-400", icon: "⏳" },
  APPROVED: { cls: "bg-blue-100 text-blue-900 ring-blue-400", icon: "✓" },
  ACTIVE: { cls: "bg-green-700 text-white ring-green-800", icon: "●" },
  SUSPENDED: { cls: "bg-red-700 text-white ring-red-800", icon: "■" },
  CLOSED: { cls: "bg-teal-100 text-teal-900 ring-teal-400", icon: "◐" },
  CLOSED_VERIFIED: { cls: "bg-slate-800 text-white ring-slate-900", icon: "✔" },
  REJECTED: { cls: "bg-red-50 text-red-800 ring-red-300", icon: "✕" },
  EXPIRED: { cls: "bg-slate-300 text-slate-800 ring-slate-400", icon: "⌛" },
  CANCELLED: { cls: "bg-slate-100 text-slate-500 ring-slate-300 line-through", icon: "⊘" },
};

export function StatusBadge({ status, large }: { status: PermitStatus; large?: boolean }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-bold ring-1 ring-inset ${s.cls} ${
        large ? "px-4 py-1.5 text-lg" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      <span aria-hidden>{s.icon}</span>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function TypeBadge({ type, short }: { type: string; short?: boolean }) {
  const def = getPermitType(type);
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${def?.badgeClass ?? "bg-slate-100 ring-slate-300"}`}>
      {short ? def?.shortLabel : def?.label ?? type}
    </span>
  );
}
