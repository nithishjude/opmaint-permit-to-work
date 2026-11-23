// Desktop list: a dense, scannable table. Each row is one link target (the
// permit number) with the whole row clickable via a stretched link.

import Link from "next/link";
import { getPermitType } from "@/domain/permit-types";
import { formatDateTime } from "@/lib/time";
import { StatusBadge } from "./badges";
import { Countdown } from "./countdown";
import { typeIcon } from "./icons";
import type { PermitRowData } from "./permit-list";

export function PermitTable({ permits }: { permits: PermitRowData[] }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full table-fixed text-left">
        <colgroup>
          <col className="w-[170px]" />
          <col />
          <col className="w-[150px]" />
          <col className="w-[200px]" />
        </colgroup>
        <thead className="border-b border-line bg-ground/70 text-[13px] font-medium text-ink-muted">
          <tr>
            <th scope="col" className="py-3 pl-5 pr-3 font-medium">Permit</th>
            <th scope="col" className="px-3 py-3 font-medium">Work & location</th>
            <th scope="col" className="px-3 py-3 font-medium">Window (IST)</th>
            <th scope="col" className="py-3 pl-3 pr-5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {permits.map((p) => {
            const Icon = typeIcon(p.type);
            const live = p.status === "ACTIVE" || p.status === "SUSPENDED";
            return (
              <tr key={p.id} className="group relative transition-colors duration-out ease-ui hover:bg-action-soft/50">
                <td className="py-3.5 pl-5 pr-3 align-top">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-ground text-ink-2">
                      <Icon aria-hidden className="h-[18px] w-[18px]" />
                    </span>
                    <div className="leading-tight">
                      <Link href={`/permits/${p.id}`} className="whitespace-nowrap font-mono text-[14px] font-semibold text-ink after:absolute after:inset-0 group-hover:text-action">
                        {p.number}
                      </Link>
                      <div className="text-[13px] text-ink-muted">{getPermitType(p.type)?.shortLabel}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5 align-top">
                  <div className="line-clamp-1 text-[15px] font-medium text-ink">{p.workDescription || <em className="text-ink-faint">No description yet</em>}</div>
                  <div className="mt-0.5 truncate text-[13px] text-ink-muted">
                    {p.area.plant.code} › {p.area.name}
                    {p.equipment ? ` › ${p.equipment.tag}` : ""} · {p.contractor || "—"}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 align-top font-mono text-[13px] text-ink-2">
                  {formatDateTime(p.plannedStart)}
                  <div className="text-ink-muted">→ {formatDateTime(p.validUntil)}</div>
                </td>
                <td className="py-3.5 pl-3 pr-5 align-top">
                  <div className="flex flex-col items-start gap-1.5">
                    <StatusBadge status={p.status} />
                    {live && (
                      <span className="text-[13px]">
                        <Countdown until={p.validUntil} refreshOnZero={false} neutral={p.status === "SUSPENDED"} />
                      </span>
                    )}
                    {p.status === "APPROVED" && new Date(p.plannedStart) > new Date() && <span className="text-[13px] text-ink-muted">Starts {formatDateTime(p.plannedStart)}</span>}
                    {p.canApprove && <span className="rounded-full bg-action px-2 py-0.5 text-[12px] font-semibold text-lime">Needs your sign-off</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
