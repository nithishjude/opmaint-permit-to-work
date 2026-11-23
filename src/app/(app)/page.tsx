import Link from "next/link";
import { BadgeCheck, CheckCheck, Hourglass, OctagonPause, Play, Plus, Timer } from "lucide-react";
import { requirePageUser } from "@/server/auth";
import { dashboardSummary } from "@/server/permits/queries";
import { PermitRows } from "@/components/permit-list";
import { StatTile } from "@/components/stat-tile";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

function Section({ id, title, count, children, tone }: { id: string; title: string; count?: number; children: React.ReactNode; tone?: "critical" | "warning" }) {
  const frame = tone === "critical" ? "rounded-md border border-critical-line bg-critical-soft/60 p-4" : tone === "warning" ? "rounded-md border border-warning-line bg-warning-soft/70 p-4" : "";
  return (
    <section aria-labelledby={id} className={frame}>
      <h2 id={id} className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight">
        {title}
        {count !== undefined && <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[13px] font-semibold tabular-nums text-ink-2">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const user = await requirePageUser();
  const d = await dashboardSummary(user);
  const isApprover = user.role !== "REQUESTER";
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{formatDateTime(new Date())} IST</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">Site status, {firstName}</h1>
          <p className="mt-1 text-ink-muted">What is live on site and what needs you.</p>
        </div>
        <Link href="/permits/new" className="btn-primary w-full sm:w-auto">
          <Plus aria-hidden />
          Raise a permit
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        <StatTile href="/permits?status=ACTIVE" label="Active now" value={d.active.length} icon={Play} tone="good" />
        <StatTile href="/permits?view=expiring" label="Expiring within 2 h" value={d.expiring.length} icon={Timer} tone="warning" />
        <StatTile href="/permits?status=SUSPENDED" label="Work stopped" value={d.suspended.length} icon={OctagonPause} tone="critical" />
        {isApprover ? (
          <StatTile href="/permits?view=my-approvals" label="Waiting for my sign-off" value={d.myApprovals.length} icon={Hourglass} tone="info" />
        ) : (
          <StatTile href="/permits?status=PENDING_APPROVAL" label="Pending approval" value={d.pendingCount} icon={Hourglass} tone="info" />
        )}
        <StatTile href="/permits?status=CLOSED" label="Awaiting close-out" value={d.awaitingVerification.length} icon={CheckCheck} tone="info" />
      </div>

      {d.suspended.length > 0 && (
        <Section id="h-susp" title="Work stopped" count={d.suspended.length} tone="critical">
          <PermitRows permits={d.suspended} />
        </Section>
      )}

      {d.expiring.length > 0 && (
        <Section id="h-exp" title="Expiring within 2 hours" count={d.expiring.length} tone="warning">
          <p className="-mt-1 mb-3 text-[15px] text-ink-2">Close the job or request an extension before the clock runs out. An expired permit can&apos;t be revived.</p>
          <PermitRows permits={d.expiring} />
        </Section>
      )}

      {isApprover && d.myApprovals.length > 0 && (
        <Section id="h-appr" title="Waiting for your sign-off" count={d.myApprovals.length}>
          <PermitRows permits={d.myApprovals} />
        </Section>
      )}

      <Section id="h-active" title="Active now" count={d.active.length}>
        <PermitRows permits={d.active} empty="No work is running under a permit right now." />
      </Section>

      <Section id="h-soon" title="Approved, ready to start" count={d.startingSoon.length}>
        <PermitRows permits={d.startingSoon} empty="Nothing approved and waiting to start." />
      </Section>

      {d.awaitingVerification.length > 0 && (
        <Section id="h-ver" title="Closed, waiting for safety close-out" count={d.awaitingVerification.length}>
          <PermitRows permits={d.awaitingVerification} />
        </Section>
      )}

      <p className="flex items-center gap-2 text-[13px] text-ink-muted">
        <BadgeCheck aria-hidden className="h-4 w-4" />
        Expiry is enforced by the server — a permit stops being valid at its end time even if nobody has this page open.
      </p>
    </div>
  );
}
