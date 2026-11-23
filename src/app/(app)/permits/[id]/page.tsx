import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/server/auth";
import { getPermitDetail } from "@/server/permits/queries";
import { asPrecautions, asTypeData } from "@/server/permits/repository";
import { DomainError } from "@/domain/errors";
import { requirePermitType } from "@/domain/permit-types";
import { peopleInside } from "@/domain/guards";
import { formatDateTime } from "@/lib/time";
import { StatusBadge, TypeBadge } from "@/components/badges";
import { Countdown } from "@/components/countdown";
import { TypeDataView } from "@/components/type-data-view";
import { ActionPanel } from "@/components/action-panel";
import { ReadingsForm } from "@/components/readings-form";
import { WorkLogPanel } from "@/components/work-log-panel";
import { ExtensionPanel } from "@/components/extension-panel";
import { AuditTimeline } from "@/components/audit-timeline";
import { ApprovalTrail } from "@/components/approval-trail";
import { PermitQr } from "@/components/permit-qr";

export const dynamic = "force-dynamic";

async function load(id: string) {
  const user = await requirePageUser();
  try {
    return { user, ...(await getPermitDetail(user, id)) };
  } catch (e) {
    if (e instanceof DomainError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { permit } = await load(id);
  return { title: permit.number };
}

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      <h2 className="mb-3 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

export default async function PermitDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string }> }) {
  const { id } = await params;
  const { submitted } = await searchParams;
  const { permit, actions, blockers, conflicts, status } = await load(id);
  const def = requirePermitType(permit.type);
  const typeData = asTypeData(permit.typeData);
  const precautions = asPrecautions(permit.precautions);
  const inside = def.hasEntryRegister ? peopleInside(permit.workLogs) : [];
  const live = status === "ACTIVE" || status === "SUSPENDED" || status === "APPROVED";
  const showExtensions = permit.extensions.length > 0 || actions.includes("REQUEST_EXTENSION");

  const heroTone =
    status === "ACTIVE" ? "border-green-700" : status === "SUSPENDED" ? "border-red-700 bg-red-50" : status === "EXPIRED" || status === "REJECTED" || status === "CANCELLED" ? "border-slate-400 bg-slate-50" : "border-slate-300";

  return (
    <div className="space-y-4">
      <Link href="/permits" className="text-sm font-semibold text-slate-600 hover:underline">
        ← All permits
      </Link>

      {submitted && (
        <div role="status" className="rounded-lg bg-green-50 p-3 font-semibold text-green-900 ring-1 ring-green-300">
          ✓ Submitted. The approvers have been notified.
        </div>
      )}

      {/* HERO — readable at arm's length: what, where, is it valid right now */}
      <header className={`card border-l-8 p-4 sm:p-6 ${heroTone}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg font-black">{permit.number}</span>
              <TypeBadge type={permit.type} />
            </div>
            <StatusBadge status={status} large />
            <h1 className="text-xl font-bold leading-snug sm:text-2xl">{permit.workDescription || "Untitled draft"}</h1>
            <p className="text-base font-semibold text-slate-800">
              📍 {permit.area.plant.name} › {permit.area.name}
              {permit.equipment ? ` › ${permit.equipment.tag} (${permit.equipment.name})` : ""}
              {permit.locationDetail ? <span className="block text-sm font-normal text-slate-600">{permit.locationDetail}</span> : null}
            </p>
            <p className="text-sm text-slate-700">
              🕑 {formatDateTime(permit.plannedStart)} → {formatDateTime(permit.validUntil)} IST
              {permit.validUntil.getTime() !== permit.plannedEnd.getTime() && <span className="ml-1 font-semibold text-blue-800">(extended)</span>}
            </p>
            <p className="text-sm text-slate-700">
              👷 {permit.contractor || "—"}
              {permit.crewSize ? ` · crew of ${permit.crewSize}` : ""} · requested by {permit.requester.name}
            </p>
            {live && (
              <div className="pt-1">
                {status === "APPROVED" && permit.plannedStart > new Date() ? (
                  <span className="font-semibold text-slate-700">
                    Can start in <Countdown until={permit.plannedStart} label="" refreshOnZero />
                  </span>
                ) : (
                  <Countdown until={permit.validUntil} size="lg" />
                )}
              </div>
            )}
          </div>
          <div className="hidden sm:block">{status !== "DRAFT" && <PermitQr permitId={permit.id} number={permit.number} />}</div>
        </div>
      </header>

      {conflicts.length > 0 && (
        <div className="rounded-xl border-2 border-red-700 bg-red-50 p-4">
          <p className="font-black text-red-900">⚠ Simultaneous operations — check before approving or starting</p>
          <ul className="mt-1 space-y-1 text-sm text-red-950">
            {conflicts.map((c) => (
              <li key={c.id}>
                <Link href={`/permits/${c.id}`} className="font-bold underline">
                  {c.number}
                </Link>{" "}
                <TypeBadge type={c.type} /> {c.workDescription} · {formatDateTime(c.plannedStart)}–{formatDateTime(c.validUntil)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Actions first on mobile */}
        <div className="space-y-4 lg:order-2">
          <Section title="Actions">
            <ActionPanel permitId={permit.id} actions={actions} activateBlocker={blockers.ACTIVATE} peopleInside={inside} />
            {actions.includes("UPDATE_READINGS") && (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <ReadingsForm permitId={permit.id} type={permit.type} typeData={typeData} status={status} />
              </div>
            )}
          </Section>

          <Section title="Approvals">
            <ApprovalTrail approvals={permit.approvals} areaOwnerName={permit.area.owner?.name} />
          </Section>

          {showExtensions && (
            <Section title="Extension">
              <ExtensionPanel
                permitId={permit.id}
                extensions={permit.extensions}
                canRequest={actions.includes("REQUEST_EXTENSION")}
                canDecide={actions.includes("DECIDE_EXTENSION")}
                extensionCount={permit.extensionCount}
                validUntil={permit.validUntil}
              />
            </Section>
          )}

          {status !== "DRAFT" && (
            <section className="card p-4 sm:hidden">
              <PermitQr permitId={permit.id} number={permit.number} />
            </section>
          )}
        </div>

        <div className="space-y-4 lg:order-1 lg:col-span-2">
          {(status === "ACTIVE" || permit.workLogs.length > 0) && (
            <Section title={def.hasEntryRegister ? "Entry register & work log" : "Work log"}>
              <WorkLogPanel permitId={permit.id} logs={permit.workLogs} canLog={actions.includes("LOG_WORK")} hasEntryRegister={Boolean(def.hasEntryRegister)} peopleInside={inside} />
            </Section>
          )}

          <Section title="Hazards & PPE">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h3 className="section-title mb-2">Hazards</h3>
                <ul className="flex flex-wrap gap-2">
                  {permit.hazards.map((h) => (
                    <li key={h} className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-900">
                      ⚠ {h}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="section-title mb-2">PPE required</h3>
                <ul className="flex flex-wrap gap-2">
                  {permit.ppe.map((p) => (
                    <li key={p} className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-900">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <h3 className="section-title mb-2 mt-5">Precautions</h3>
            <ul className="space-y-1">
              {precautions.map((p) => (
                <li key={p.id} className="flex gap-2">
                  <span className={p.checked ? "text-green-700" : "text-slate-400"} aria-label={p.checked ? "confirmed" : "not confirmed"}>
                    {p.checked ? "☑" : "☐"}
                  </span>
                  <span>
                    {p.label}
                    {p.custom && <span className="ml-1 text-xs text-slate-500">(site-specific)</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={`${def.label} details`}>
            <TypeDataView fields={def.fields} data={typeData} />
          </Section>

          {(permit.completionNotes || permit.verificationNotes) && (
            <Section title="Closure">
              {permit.completionNotes && (
                <div className="mb-3">
                  <h3 className="section-title">Completion notes · {formatDateTime(permit.closedAt)}</h3>
                  <p className="whitespace-pre-line">{permit.completionNotes}</p>
                </div>
              )}
              {permit.verificationNotes && (
                <div>
                  <h3 className="section-title">Safety verification · {formatDateTime(permit.verifiedAt)}</h3>
                  <p className="whitespace-pre-line">{permit.verificationNotes}</p>
                </div>
              )}
            </Section>
          )}

          <Section title="Audit trail">
            <p className="mb-3 text-sm text-slate-600">Every change to this permit, in order. Entries can&apos;t be edited or deleted.</p>
            <AuditTimeline entries={permit.auditLogs} />
          </Section>
        </div>
      </div>
    </div>
  );
}
