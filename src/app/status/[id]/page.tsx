import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicStatus } from "@/server/permits/queries";
import { DomainError } from "@/domain/errors";
import { getPermitType } from "@/domain/permit-types";
import { STATUS_LABELS } from "@/domain/enums";
import { formatDateTime } from "@/lib/time";
import { Countdown } from "@/components/countdown";

export const metadata: Metadata = { title: "Permit status", robots: { index: false } };
export const dynamic = "force-dynamic";

// What a safety walk-around sees after scanning the QR pinned at the job.
// No login, no names — just: may this work be happening right now?
export default async function PublicStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let p;
  try {
    p = await getPublicStatus(id);
  } catch (e) {
    if (e instanceof DomainError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const workAllowed = p.status === "ACTIVE";
  const banner = workAllowed
    ? { bg: "bg-green-700", text: "WORK AUTHORISED", sub: "This permit is active." }
    : p.status === "SUSPENDED"
      ? { bg: "bg-red-700", text: "STOP — WORK SUSPENDED", sub: "Work must not continue until a safety officer resumes the permit." }
      : p.status === "APPROVED"
        ? { bg: "bg-blue-700", text: "NOT STARTED", sub: "Approved, but work has not been activated yet." }
        : { bg: "bg-slate-800", text: "WORK NOT AUTHORISED", sub: `Permit is ${STATUS_LABELS[p.status].toLowerCase()}.` };

  return (
    <main className="min-h-screen bg-slate-100">
      <div className={`${banner.bg} px-4 py-8 text-center text-white`}>
        <p className="text-sm font-bold uppercase tracking-widest opacity-80">{p.number}</p>
        <p className="mt-1 text-3xl font-black sm:text-4xl">{banner.text}</p>
        <p className="mt-1">{banner.sub}</p>
        {(p.status === "ACTIVE" || p.status === "SUSPENDED") && (
          <div className="mx-auto mt-4 w-fit rounded-xl bg-white px-6 py-3">
            <Countdown until={p.validUntil} size="lg" />
          </div>
        )}
      </div>
      <div className="mx-auto max-w-md space-y-3 p-4">
        <dl className="card divide-y divide-slate-100 p-0 text-base">
          {[
            ["Type", getPermitType(p.type)?.label ?? p.type],
            ["Status", STATUS_LABELS[p.status]],
            ["Location", `${p.area.plant.name} › ${p.area.name}${p.equipment ? ` › ${p.equipment.tag}` : ""}`],
            ["Work", p.workDescription],
            ["Contractor", p.contractor],
            ["Valid", `${formatDateTime(p.plannedStart)} → ${formatDateTime(p.validUntil)} IST`],
            ["Sign-offs", `${p.approvals.filter((a) => a.decision === "APPROVED").length} of ${p.approvals.length}`],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3 px-4 py-3">
              <dt className="w-24 shrink-0 text-sm font-semibold text-slate-600">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-center text-xs text-slate-500">Status checked live at {formatDateTime(new Date())} IST. Sign in for full details.</p>
      </div>
    </main>
  );
}
