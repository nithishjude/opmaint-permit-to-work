import { CircleCheck, CircleX, Hourglass } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/domain/enums";
import { formatDateTime } from "@/lib/time";

interface Approval {
  id: string;
  role: string;
  decision: string;
  comment: string | null;
  signature: string | null;
  decidedAt: Date | null;
  approver: { name: string } | null;
}

const DECISION = {
  APPROVED: { icon: CircleCheck, label: "Approved", cls: "text-good", box: "border-good-line" },
  REJECTED: { icon: CircleX, label: "Rejected", cls: "text-critical", box: "border-critical-line" },
  PENDING: { icon: Hourglass, label: "Waiting", cls: "text-warning", box: "border-line" },
} as const;

export function ApprovalTrail({ approvals, areaOwnerName }: { approvals: Approval[]; areaOwnerName?: string | null }) {
  if (approvals.length === 0) return <p className="text-[15px] text-ink-muted">Sign-offs are requested when the permit is submitted.</p>;
  return (
    <ul className="space-y-3">
      {approvals.map((a) => {
        const d = DECISION[a.decision as keyof typeof DECISION] ?? DECISION.PENDING;
        const Icon = d.icon;
        return (
          <li key={a.id} className={`rounded-sm border ${d.box} p-3.5`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{ROLE_LABELS[a.role as Role]}</span>
              <span className={`inline-flex items-center gap-1.5 text-[14px] font-semibold ${d.cls}`}>
                <Icon aria-hidden className="h-4 w-4" />
                {d.label}
              </span>
            </div>
            {a.approver ? (
              <p className="mt-0.5 text-[14px] text-ink-muted">
                {a.approver.name} · <span className="font-mono text-[13px]">{formatDateTime(a.decidedAt)}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-[14px] text-ink-muted">{a.role === "AREA_OWNER" && areaOwnerName ? `Waiting for ${areaOwnerName}` : "Any safety officer can sign"}</p>
            )}
            {a.comment && <p className="mt-2 border-l-2 border-line-strong pl-3 text-[15px] italic text-ink-2">“{a.comment}”</p>}
            {a.signature && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.signature} alt={`Signature of ${a.approver?.name ?? "approver"}`} className="mt-3 h-14 w-auto rounded-sm border border-line bg-white" />
            )}
          </li>
        );
      })}
    </ul>
  );
}
