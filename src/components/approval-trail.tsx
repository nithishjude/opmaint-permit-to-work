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

export function ApprovalTrail({ approvals, areaOwnerName }: { approvals: Approval[]; areaOwnerName?: string | null }) {
  if (approvals.length === 0) return <p className="text-sm text-slate-500">Approvals are requested when the permit is submitted.</p>;
  return (
    <ul className="space-y-3">
      {approvals.map((a) => (
        <li
          key={a.id}
          className={`rounded-lg p-3 ring-1 ${a.decision === "APPROVED" ? "bg-green-50 ring-green-300" : a.decision === "REJECTED" ? "bg-red-50 ring-red-300" : "bg-slate-50 ring-slate-200"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold">{ROLE_LABELS[a.role as Role]}</span>
            <span className={`text-sm font-bold ${a.decision === "APPROVED" ? "text-green-800" : a.decision === "REJECTED" ? "text-red-800" : "text-amber-800"}`}>
              {a.decision === "APPROVED" ? "✓ Approved" : a.decision === "REJECTED" ? "✕ Rejected" : "⏳ Waiting"}
            </span>
          </div>
          {a.approver ? (
            <p className="text-sm text-slate-700">
              {a.approver.name} · {formatDateTime(a.decidedAt)}
            </p>
          ) : (
            <p className="text-sm text-slate-500">{a.role === "AREA_OWNER" && areaOwnerName ? `Waiting for ${areaOwnerName}` : "Any safety officer"}</p>
          )}
          {a.comment && <p className="mt-1 text-sm italic text-slate-800">“{a.comment}”</p>}
          {a.signature && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.signature} alt={`Signature of ${a.approver?.name ?? "approver"}`} className="mt-2 h-14 w-auto rounded bg-white ring-1 ring-slate-200" />
          )}
        </li>
      ))}
    </ul>
  );
}
