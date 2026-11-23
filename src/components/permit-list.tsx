import Link from "next/link";
import { Clock, HardHat, MapPin, UserRound } from "lucide-react";
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
  if (permits.length === 0) {
    return <p className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center text-ink-muted">{empty}</p>;
  }
  return (
    <ul className="space-y-3">
      {permits.map((p) => (
        <li key={p.id}>
          <Link href={`/permits/${p.id}`} className="card-link p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[15px] font-semibold tracking-tight text-ink">{p.number}</span>
              <TypeBadge type={p.type} />
              <StatusBadge status={p.status} />
              {p.canApprove && (
                <span className="inline-flex items-center rounded-full bg-action px-2.5 py-0.5 text-[13px] font-semibold text-white">Needs your sign-off</span>
              )}
              <span className="ml-auto text-[15px]">
                {p.status === "ACTIVE" || p.status === "SUSPENDED" ? (
                  <Countdown until={p.validUntil} refreshOnZero={false} neutral={p.status === "SUSPENDED"} />
                ) : p.status === "APPROVED" && new Date(p.plannedStart) > new Date() ? (
                  <span className="text-ink-muted">Starts {formatDateTime(p.plannedStart)}</span>
                ) : null}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-base font-semibold leading-snug text-ink">
              {p.workDescription || <em className="font-normal text-ink-faint">No description yet</em>}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden className="h-4 w-4" />
                {p.area.plant.code} › {p.area.name}
                {p.equipment ? ` › ${p.equipment.tag}` : ""}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock aria-hidden className="h-4 w-4" />
                <span className="font-mono text-[13px]">
                  {formatDateTime(p.plannedStart)} → {formatDateTime(p.validUntil)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <HardHat aria-hidden className="h-4 w-4" />
                {p.contractor || "—"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound aria-hidden className="h-4 w-4" />
                {p.requester.name}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
