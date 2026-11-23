import Link from "next/link";
import { requirePageUser } from "@/server/auth";
import { dashboardSummary } from "@/server/permits/queries";
import { PermitRows } from "@/components/permit-list";

export const dynamic = "force-dynamic";

function Tile({ href, label, value, tone }: { href: string; label: string; value: number; tone: string }) {
  return (
    <Link href={href} className={`rounded-xl p-4 shadow-sm ring-1 ring-inset transition hover:shadow ${tone}`}>
      <div className="text-4xl font-black tabular-nums">{value}</div>
      <div className="text-sm font-bold">{label}</div>
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await requirePageUser();
  const d = await dashboardSummary(user);
  const isApprover = user.role !== "REQUESTER";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Right now</h1>
          <p className="text-slate-600">What is live on site, and what needs attention.</p>
        </div>
        <Link href="/permits/new" className="btn-primary">
          + Raise a permit
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile href="/permits?status=ACTIVE" label="Active now" value={d.active.length} tone="bg-green-700 text-white ring-green-800" />
        <Tile href="/permits?view=expiring" label="Expiring < 2 h" value={d.expiring.length} tone={d.expiring.length ? "bg-amber-400 text-slate-950 ring-amber-500" : "bg-white ring-slate-200"} />
        <Tile href="/permits?status=SUSPENDED" label="Suspended (work stopped)" value={d.suspended.length} tone={d.suspended.length ? "bg-red-700 text-white ring-red-800" : "bg-white ring-slate-200"} />
        {isApprover ? (
          <Tile href="/permits?view=my-approvals" label="Waiting for my approval" value={d.myApprovals.length} tone={d.myApprovals.length ? "bg-blue-700 text-white ring-blue-800" : "bg-white ring-slate-200"} />
        ) : (
          <Tile href="/permits?status=PENDING_APPROVAL" label="Pending approval" value={d.pendingCount} tone="bg-white ring-slate-200" />
        )}
        <Tile href="/permits?status=CLOSED" label="Awaiting close-out check" value={d.awaitingVerification.length} tone="bg-white ring-slate-200" />
      </div>

      {d.suspended.length > 0 && (
        <section aria-labelledby="h-susp" className="rounded-xl border-2 border-red-700 bg-red-50 p-4">
          <h2 id="h-susp" className="mb-2 text-lg font-black text-red-900">■ Work stopped</h2>
          <PermitRows permits={d.suspended} />
        </section>
      )}

      {d.expiring.length > 0 && (
        <section aria-labelledby="h-exp" className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4">
          <h2 id="h-exp" className="mb-1 text-lg font-black text-amber-950">⌛ Expiring in the next 2 hours</h2>
          <p className="mb-2 text-sm text-amber-950">Finish and close, or request an extension before the clock runs out. Expired permits can&apos;t be revived.</p>
          <PermitRows permits={d.expiring} />
        </section>
      )}

      {isApprover && d.myApprovals.length > 0 && (
        <section aria-labelledby="h-appr">
          <h2 id="h-appr" className="mb-2 text-lg font-black">Waiting for your approval</h2>
          <PermitRows permits={d.myApprovals} />
        </section>
      )}

      <section aria-labelledby="h-active">
        <h2 id="h-active" className="mb-2 text-lg font-black">● Active now</h2>
        <PermitRows permits={d.active} empty="No work is running under a permit right now." />
      </section>

      <section aria-labelledby="h-soon">
        <h2 id="h-soon" className="mb-2 text-lg font-black">Approved, ready to start</h2>
        <PermitRows permits={d.startingSoon} empty="Nothing approved and waiting." />
      </section>

      {d.awaitingVerification.length > 0 && (
        <section aria-labelledby="h-ver">
          <h2 id="h-ver" className="mb-2 text-lg font-black">Closed — waiting for safety close-out</h2>
          <PermitRows permits={d.awaitingVerification} />
        </section>
      )}
    </div>
  );
}
