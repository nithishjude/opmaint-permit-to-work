import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, CircleDashed, Clock, HardHat, MapPin, ShieldAlert, TriangleAlert, UserRound } from "lucide-react";
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
import { typeIcon } from "@/components/icons";

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

function Panel({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="panel-title">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Left rule on the hero = the permit's state, readable from arm's length. */
const HERO_RULE: Record<string, string> = {
  ACTIVE: "border-l-good",
  SUSPENDED: "border-l-critical",
  APPROVED: "border-l-info",
  PENDING_APPROVAL: "border-l-warning-fill",
  CLOSED: "border-l-info",
  CLOSED_VERIFIED: "border-l-ink",
  REJECTED: "border-l-critical",
};

export default async function PermitDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string }> }) {
  const { id } = await params;
  const { submitted } = await searchParams;
  const { permit, actions, blockers, conflicts, status } = await load(id);
  const def = requirePermitType(permit.type);
  const TypeIcon = typeIcon(permit.type);
  const typeData = asTypeData(permit.typeData);
  const precautions = asPrecautions(permit.precautions);
  const inside = def.hasEntryRegister ? peopleInside(permit.workLogs) : [];
  const live = status === "ACTIVE" || status === "SUSPENDED" || status === "APPROVED";
  const showExtensions = permit.extensions.length > 0 || actions.includes("REQUEST_EXTENSION");
  const extended = permit.validUntil.getTime() !== permit.plannedEnd.getTime();

  return (
    <div className="space-y-5">
      <Link href="/permits" className="btn-text -ml-2">
        <ArrowLeft aria-hidden />
        All permits
      </Link>

      {submitted && (
        <div role="status" className="callout-good">
          <CircleCheck aria-hidden />
          <div>
            <p className="font-semibold">Submitted for approval</p>
            <p className="text-[15px] text-ink-2">The area owner and safety officers have been notified.</p>
          </div>
        </div>
      )}

      {/* HERO — what, where, and is it valid right now */}
      <header className={`card border-l-[6px] ${HERO_RULE[status] ?? "border-l-line-strong"} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[17px] font-semibold tracking-tight">{permit.number}</span>
              <TypeBadge type={permit.type} />
            </div>
            <div className="mt-3">
              <StatusBadge status={status} large />
            </div>
            <h1 className="mt-3 flex gap-3 text-[22px] font-semibold leading-snug tracking-tight sm:text-[26px]">
              <TypeIcon aria-hidden className="mt-1 hidden h-6 w-6 shrink-0 text-ink-muted sm:block" />
              {permit.workDescription || "Untitled draft"}
            </h1>
            <dl className="mt-4 grid gap-2.5 text-[15px] text-ink-2 sm:grid-cols-2">
              <div className="flex gap-2.5 sm:col-span-2">
                <dt>
                  <MapPin aria-label="Location" className="mt-0.5 h-[18px] w-[18px] text-ink-muted" />
                </dt>
                <dd>
                  <span className="font-semibold text-ink">
                    {permit.area.plant.name} › {permit.area.name}
                    {permit.equipment ? ` › ${permit.equipment.tag}` : ""}
                  </span>
                  {permit.equipment && <span className="text-ink-muted"> · {permit.equipment.name}</span>}
                  {permit.locationDetail && <span className="block text-ink-muted">{permit.locationDetail}</span>}
                </dd>
              </div>
              <div className="flex gap-2.5">
                <dt>
                  <Clock aria-label="Window" className="mt-0.5 h-[18px] w-[18px] text-ink-muted" />
                </dt>
                <dd className="font-mono text-[14px]">
                  {formatDateTime(permit.plannedStart)} → {formatDateTime(permit.validUntil)}
                  {extended && <span className="ml-2 font-sans text-[13px] font-semibold text-info">extended</span>}
                </dd>
              </div>
              <div className="flex gap-2.5">
                <dt>
                  <HardHat aria-label="Contractor" className="mt-0.5 h-[18px] w-[18px] text-ink-muted" />
                </dt>
                <dd>
                  {permit.contractor || "—"}
                  {permit.crewSize ? ` · crew of ${permit.crewSize}` : ""}
                </dd>
              </div>
              <div className="flex gap-2.5">
                <dt>
                  <UserRound aria-label="Requested by" className="mt-0.5 h-[18px] w-[18px] text-ink-muted" />
                </dt>
                <dd>Requested by {permit.requester.name}</dd>
              </div>
            </dl>
          </div>

          <div className="flex w-full flex-col items-start gap-4 sm:w-auto sm:items-end">
            {live && (
              <div className="w-full rounded-md bg-ground px-4 py-3 sm:w-auto sm:min-w-[220px] sm:text-right">
                {status === "APPROVED" && permit.plannedStart > new Date() ? (
                  <>
                    <div className="eyebrow">Can start in</div>
                    <Countdown until={permit.plannedStart} label="" size="lg" refreshOnZero />
                  </>
                ) : (
                  <>
                    <div className="eyebrow">{status === "SUSPENDED" ? "Window closes in" : "Valid for"}</div>
                    <Countdown until={permit.validUntil} label="" size="lg" neutral={status === "SUSPENDED"} />
                  </>
                )}
              </div>
            )}
            <div className="hidden sm:block">{status !== "DRAFT" && <PermitQr permitId={permit.id} number={permit.number} />}</div>
          </div>
        </div>
      </header>

      {conflicts.length > 0 && (
        <div className="callout-critical">
          <ShieldAlert aria-hidden />
          <div>
            <p className="font-semibold">Simultaneous operations — check before approving or starting</p>
            <ul className="mt-2 space-y-1.5 text-[15px]">
              {conflicts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/permits/${c.id}`} className="link font-mono">
                    {c.number}
                  </Link>
                  <TypeBadge type={c.type} />
                  <span className="text-ink-2">{c.workDescription}</span>
                  <span className="font-mono text-[13px] text-ink-muted">
                    {formatDateTime(c.plannedStart)}–{formatDateTime(c.validUntil)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Actions come first on a phone */}
        <div className="space-y-5 lg:order-2">
          <Panel title="Actions">
            <ActionPanel permitId={permit.id} actions={actions} activateBlocker={blockers.ACTIVATE} peopleInside={inside} />
            {actions.includes("UPDATE_READINGS") && (
              <div className="mt-4 border-t border-line pt-4">
                <ReadingsForm permitId={permit.id} type={permit.type} typeData={typeData} status={status} />
              </div>
            )}
          </Panel>

          <Panel title="Approvals" aside={<span className="meta">{permit.approvals.filter((a) => a.decision === "APPROVED").length} of {permit.approvals.length || def.requiredApprovals.length} signed</span>}>
            <ApprovalTrail approvals={permit.approvals} areaOwnerName={permit.area.owner?.name} />
          </Panel>

          {showExtensions && (
            <Panel title="Extension">
              <ExtensionPanel
                permitId={permit.id}
                extensions={permit.extensions}
                canRequest={actions.includes("REQUEST_EXTENSION")}
                canDecide={actions.includes("DECIDE_EXTENSION")}
                extensionCount={permit.extensionCount}
                validUntil={permit.validUntil}
              />
            </Panel>
          )}

          {status !== "DRAFT" && (
            <section className="card p-4 sm:hidden">
              <PermitQr permitId={permit.id} number={permit.number} />
            </section>
          )}
        </div>

        <div className="space-y-5 lg:order-1 lg:col-span-2">
          {(status === "ACTIVE" || permit.workLogs.length > 0) && (
            <Panel title={def.hasEntryRegister ? "Entry register & work log" : "Work log"}>
              <WorkLogPanel permitId={permit.id} logs={permit.workLogs} canLog={actions.includes("LOG_WORK")} hasEntryRegister={Boolean(def.hasEntryRegister)} peopleInside={inside} />
            </Panel>
          )}

          <Panel title="Hazards, PPE & precautions">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <h3 className="eyebrow mb-2">Hazards identified</h3>
                <ul className="flex flex-wrap gap-2">
                  {permit.hazards.map((h) => (
                    <li key={h} className="chip border-critical-line bg-critical-soft text-ink">
                      <TriangleAlert aria-hidden className="h-3.5 w-3.5 text-critical" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="eyebrow mb-2">PPE required</h3>
                <ul className="flex flex-wrap gap-2">
                  {permit.ppe.map((p) => (
                    <li key={p} className="chip">
                      <HardHat aria-hidden className="h-3.5 w-3.5 text-ink-muted" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <h3 className="eyebrow mb-2 mt-6">Precautions</h3>
            <ul className="divide-y divide-line rounded-sm border border-line">
              {precautions.map((p) => (
                <li key={p.id} className="flex items-start gap-3 px-3.5 py-3">
                  {p.checked ? (
                    <CircleCheck aria-label="Confirmed" className="mt-0.5 h-5 w-5 shrink-0 text-good" />
                  ) : (
                    <CircleDashed aria-label="Not confirmed" className="mt-0.5 h-5 w-5 shrink-0 text-ink-faint" />
                  )}
                  <span className="text-[15px] leading-snug">
                    {p.label}
                    {p.custom && <span className="ml-2 text-[13px] text-ink-muted">site-specific</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={`${def.label} details`}>
            <TypeDataView fields={def.fields} data={typeData} />
          </Panel>

          {(permit.completionNotes || permit.verificationNotes) && (
            <Panel title="Closure">
              <div className="space-y-4">
                {permit.completionNotes && (
                  <div>
                    <h3 className="eyebrow">Completion notes · {formatDateTime(permit.closedAt)}</h3>
                    <p className="mt-1 whitespace-pre-line">{permit.completionNotes}</p>
                  </div>
                )}
                {permit.verificationNotes && (
                  <div>
                    <h3 className="eyebrow">Safety verification · {formatDateTime(permit.verifiedAt)}</h3>
                    <p className="mt-1 whitespace-pre-line">{permit.verificationNotes}</p>
                  </div>
                )}
              </div>
            </Panel>
          )}

          <Panel title="Audit trail" aside={<span className="meta">{permit.auditLogs.length} entries · append-only</span>}>
            <AuditTimeline entries={permit.auditLogs} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
