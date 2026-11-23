import Link from "next/link";
import { CheckCheck, Hourglass, OctagonPause, Play, Plus, Timer } from "lucide-react";
import { requirePageUser } from "@/server/auth";
import { dashboardSummary, siteTimeline } from "@/server/permits/queries";
import { PermitRows } from "@/components/permit-list";
import { StatTile } from "@/components/stat-tile";
import { SiteTimeline } from "@/components/site-timeline";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

function Group({ id, title, count, hint, children, tone }: { id: string; title: string; count: number; hint?: string; children: React.ReactNode; tone?: "critical" | "warning" | "info" | "good" }) {
  const dot = tone === "good" ? "bg-good" : tone === "critical" ? "bg-critical" : tone === "warning" ? "bg-warning-fill" : tone === "info" ? "bg-action" : "bg-ink-faint";
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span aria-hidden className={`h-2 w-2 shrink-0 translate-y-[-2px] rounded-full ${dot}`} />
        <h2 id={id} className="text-[17px] font-semibold tracking-tight">
          {title}
        </h2>
        <span className="text-[14px] font-medium tabular-nums text-ink-muted">{count}</span>
      </div>
      {hint && <p className="-mt-1 text-[14px] text-ink-muted">{hint}</p>}
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const user = await requirePageUser();
  const [d, timeline] = await Promise.all([dashboardSummary(user), siteTimeline()]);
  const isApprover = user.role !== "REQUESTER";
  const firstName = user.name.split(" ")[0];
  const attention = d.suspended.length + d.expiring.length + (isApprover ? d.myApprovals.length : 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[13px] text-ink-muted">{formatDateTime(new Date())} IST</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">Good to see you, {firstName}</h1>
          <p className="mt-1 text-ink-muted">
            {attention > 0 ? `${attention} item${attention === 1 ? "" : "s"} need${attention === 1 ? "s" : ""} attention across both plants.` : "Nothing needs your attention right now."}
          </p>
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

      <SiteTimeline data={timeline} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          {d.suspended.length > 0 && (
            <Group id="h-susp" title="Work stopped" count={d.suspended.length} tone="critical" hint="Only a safety officer can resume these.">
              <PermitRows permits={d.suspended} />
            </Group>
          )}
          {d.expiring.length > 0 && (
            <Group id="h-exp" title="Expiring within 2 hours" count={d.expiring.length} tone="warning" hint="Close the job or request an extension. An expired permit can't be revived.">
              <PermitRows permits={d.expiring} />
            </Group>
          )}
          {isApprover && (
            <Group id="h-appr" title="Waiting for your sign-off" count={d.myApprovals.length} tone="info">
              <PermitRows permits={d.myApprovals} empty="Nothing is waiting for your signature." />
            </Group>
          )}
          <Group id="h-soon" title="Approved, ready to start" count={d.startingSoon.length}>
            <PermitRows permits={d.startingSoon} empty="Nothing approved and waiting to start." />
          </Group>
        </div>
        <div className="space-y-8">
          <Group id="h-active" title="Active now" count={d.active.length} tone="good">
            <PermitRows permits={d.active} empty="No work is running under a permit right now." />
          </Group>
          {d.awaitingVerification.length > 0 && (
            <Group id="h-ver" title="Closed, waiting for safety close-out" count={d.awaitingVerification.length}>
              <PermitRows permits={d.awaitingVerification} />
            </Group>
          )}
        </div>
      </div>
    </div>
  );
}
