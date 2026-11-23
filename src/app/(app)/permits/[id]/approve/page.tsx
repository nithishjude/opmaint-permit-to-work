import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageUser } from "@/server/auth";
import { getPermitDetail } from "@/server/permits/queries";
import { asPrecautions, asTypeData } from "@/server/permits/repository";
import { DomainError } from "@/domain/errors";
import { findApprovalSlot } from "@/domain/permissions";
import { requirePermitType } from "@/domain/permit-types";
import { ROLE_LABELS } from "@/domain/enums";
import { toAuthView } from "@/server/permits/repository";
import { formatDateTime } from "@/lib/time";
import { StatusBadge, TypeBadge } from "@/components/badges";
import { TypeDataView } from "@/components/type-data-view";
import { ApprovalTrail } from "@/components/approval-trail";
import { ApprovalForm } from "./approval-form";

export const metadata: Metadata = { title: "Approve permit" };
export const dynamic = "force-dynamic";

export default async function ApprovePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  let detail;
  try {
    detail = await getPermitDetail(user, id);
  } catch (e) {
    if (e instanceof DomainError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { permit, actions, conflicts } = detail;
  if (!actions.includes("APPROVE")) redirect(`/permits/${id}`);

  const def = requirePermitType(permit.type);
  const slot = findApprovalSlot(user, toAuthView({ ...permit, extensions: [] }));
  const slotLabel = "slot" in slot ? ROLE_LABELS[slot.slot.role] : ROLE_LABELS[user.role];
  const precautions = asPrecautions(permit.precautions);
  const durationH = (permit.plannedEnd.getTime() - permit.plannedStart.getTime()) / 3_600_000;

  // What the approver must physically confirm before signing.
  const checklist = [
    `Job scope is clear and limited to: ${permit.area.name}${permit.equipment ? ` / ${permit.equipment.tag}` : ""}`,
    `Hazards listed are complete (${permit.hazards.length} identified)`,
    `Precautions are actually in place on site (${precautions.length} items)`,
    `Window ${formatDateTime(permit.plannedStart)} → ${formatDateTime(permit.plannedEnd)} (${durationH.toFixed(1)} h) is acceptable for the area`,
    ...(conflicts.length ? [`I have reviewed the overlapping ${conflicts.map((c) => c.number).join(", ")} and the jobs are safe together`] : []),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href={`/permits/${id}`} className="text-sm font-semibold text-slate-600 hover:underline">
        ← Back to permit
      </Link>
      <header className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-lg font-black">{permit.number}</span>
          <TypeBadge type={permit.type} />
          <StatusBadge status={permit.status} />
        </div>
        <h1 className="mt-2 text-xl font-bold">{permit.workDescription}</h1>
        <p className="text-slate-700">
          {permit.area.plant.name} › {permit.area.name}
          {permit.equipment ? ` › ${permit.equipment.tag}` : ""} · {permit.contractor}
          {permit.crewSize ? ` (${permit.crewSize})` : ""} · requested by {permit.requester.name}
        </p>
        <p className="mt-1 font-semibold">You are signing as: {slotLabel}</p>
      </header>

      {conflicts.length > 0 && (
        <div className="rounded-xl border-2 border-red-700 bg-red-50 p-4 text-red-950">
          <p className="font-black">⚠ Overlaps with incompatible work in the same area</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {conflicts.map((c) => (
              <li key={c.id}>
                <Link className="font-bold underline" href={`/permits/${c.id}`} target="_blank">
                  {c.number}
                </Link>{" "}
                ({c.type.replace("_", " ").toLowerCase()}, {c.status.toLowerCase()}) {formatDateTime(c.plannedStart)} → {formatDateTime(c.validUntil)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <section className="card p-4 sm:p-5">
            <h2 className="mb-3 text-lg font-black">What you are approving</h2>
            <h3 className="section-title mb-1">Hazards</h3>
            <p className="mb-3">{permit.hazards.join(" · ")}</p>
            <h3 className="section-title mb-1">PPE</h3>
            <p className="mb-3">{permit.ppe.join(" · ")}</p>
            <h3 className="section-title mb-1">Precautions confirmed by requester</h3>
            <ul className="mb-4 space-y-1">
              {precautions.map((p) => (
                <li key={p.id}>
                  {p.checked ? "☑" : "☐"} {p.label}
                </li>
              ))}
            </ul>
            <TypeDataView fields={def.fields} data={asTypeData(permit.typeData)} />
          </section>
          <section className="card p-4 sm:p-5">
            <h2 className="mb-3 text-lg font-black">Sign-offs so far</h2>
            <ApprovalTrail approvals={permit.approvals} areaOwnerName={permit.area.owner?.name} />
          </section>
        </div>
        <section className="card h-fit p-4 sm:p-5 lg:sticky lg:top-4 lg:col-span-2">
          <h2 className="mb-3 text-lg font-black">Your decision</h2>
          <ApprovalForm permitId={permit.id} slotLabel={slotLabel} checklist={checklist} />
        </section>
      </div>
    </div>
  );
}
