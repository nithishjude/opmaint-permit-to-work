import Link from "next/link";
import type { PermitStatus } from "@/domain/enums";
import { formatDateTime } from "@/lib/time";
import { StatusBadge, TypeBadge } from "./badges";
import { Countdown } from "./countdown";

export interface PermitRowData {
  id: string;
  number: string;
  type: string;
  status: PermitStatus;
  workDescription: string;
  contractor: string;
  plannedStart: Date;
  validUntil: Date;
  requester: { name: string };
  area: { name: string; plant: { name: string; code: string } };
  equipment: { tag: string } | null;
  canApprove?: boolean;
}

export function PermitRows({ permits, empty = "No permits." }: { permits: PermitRowData[]; empty?: string }) {
  if (permits.length === 0) return <p className="rounded-lg border-2 border-dashed border-slate-300 p-6 text-center text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-2">
      {permits.map((p) => (
        <li key={p.id}>
          <Link href={`/permits/${p.id}`} className="card block p-3 transition hover:border-slate-400 hover:shadow sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold">{p.number}</span>
              <TypeBadge type={p.type} />
              <StatusBadge status={p.status} />
              {p.canApprove && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-slate-950">Needs your approval</span>}
              <span className="ml-auto text-sm">
                {p.status === "ACTIVE" || p.status === "SUSPENDED" ? (
                  <Countdown until={p.validUntil} refreshOnZero={false} />
                ) : p.status === "APPROVED" && new Date(p.plannedStart) > new Date() ? (
                  <span className="text-slate-600">starts {formatDateTime(p.plannedStart)}</span>
                ) : null}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 font-semibold text-slate-900">{p.workDescription || <em className="text-slate-400">No description yet</em>}</p>
            <p className="mt-1 text-sm text-slate-600">
              {p.area.plant.code} › {p.area.name}
              {p.equipment ? ` › ${p.equipment.tag}` : ""} · {p.contractor || "—"} · {formatDateTime(p.plannedStart)} → {formatDateTime(p.validUntil)}
              {" "}· by {p.requester.name}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
