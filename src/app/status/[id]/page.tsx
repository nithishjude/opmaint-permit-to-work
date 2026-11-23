import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, CircleX, OctagonPause, type LucideIcon } from "lucide-react";
import { getPublicStatus } from "@/server/permits/queries";
import { DomainError } from "@/domain/errors";
import { getPermitType } from "@/domain/permit-types";
import { STATUS_LABELS } from "@/domain/enums";
import { formatDateTime } from "@/lib/time";
import { Countdown } from "@/components/countdown";
import { BrandMark } from "@/components/brand-mark";

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

  const verdict: { bg: string; icon: LucideIcon; title: string; sub: string } =
    p.status === "ACTIVE"
      ? { bg: "bg-good", icon: BadgeCheck, title: "Work authorised", sub: "This permit is active right now." }
      : p.status === "SUSPENDED"
        ? { bg: "bg-critical", icon: OctagonPause, title: "Stop — work suspended", sub: "Work must not continue until a safety officer resumes the permit." }
        : p.status === "APPROVED"
          ? { bg: "bg-info", icon: CircleX, title: "Not started", sub: "Approved, but work has not been started under this permit yet." }
          : { bg: "bg-ink", icon: CircleX, title: "Work not authorised", sub: `This permit is ${STATUS_LABELS[p.status].toLowerCase()}.` };
  const Icon = verdict.icon;
  const signed = p.approvals.filter((a) => a.decision === "APPROVED").length;

  const rows: [string, string][] = [
    ["Type", getPermitType(p.type)?.label ?? p.type],
    ["Location", `${p.area.plant.name} › ${p.area.name}${p.equipment ? ` › ${p.equipment.tag}` : ""}`],
    ["Work", p.workDescription],
    ["Contractor", p.contractor],
    ["Valid", `${formatDateTime(p.plannedStart)} → ${formatDateTime(p.validUntil)} IST`],
    ["Sign-offs", `${signed} of ${p.approvals.length}`],
  ];

  return (
    <main className="min-h-screen bg-ground">
      <div className={`${verdict.bg} px-4 pb-8 pt-6 text-white`}>
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between text-[13px] font-medium text-white/80">
            <span className="flex items-center gap-2">
              <BrandMark className="h-6 w-6" />
              Permit status
            </span>
            <span className="font-mono">{p.number}</span>
          </div>
          <div className="mt-8 flex items-start gap-3">
            <Icon aria-hidden className="mt-1 h-9 w-9 shrink-0" strokeWidth={2.25} />
            <div>
              <h1 className="text-[32px] font-semibold leading-tight tracking-tight">{verdict.title}</h1>
              <p className="mt-1 text-[17px] text-white/90">{verdict.sub}</p>
            </div>
          </div>
          {(p.status === "ACTIVE" || p.status === "SUSPENDED") && (
            <div className="mt-6 flex items-baseline justify-between rounded-md bg-white px-5 py-4">
              <span className="text-[15px] font-medium text-ink-2">{p.status === "SUSPENDED" ? "Window closes in" : "Valid for"}</span>
              <Countdown until={p.validUntil} size="lg" label="" neutral={p.status === "SUSPENDED"} />
            </div>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-md space-y-3 px-4 py-6">
        <dl className="card divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[96px_1fr] gap-3 px-4 py-3.5">
              <dt className="text-[13px] font-medium text-ink-muted">{k}</dt>
              <dd className="text-base font-semibold leading-snug">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-center text-[13px] text-ink-muted">Checked live at {formatDateTime(new Date())} IST · sign in for the full permit</p>
      </div>
    </main>
  );
}
