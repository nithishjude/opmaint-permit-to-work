import Link from "next/link";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth";
import { getReferenceData, listPermits, permitFiltersSchema } from "@/server/permits/queries";
import { PermitRows } from "@/components/permit-list";
import { PermitTable } from "@/components/permit-table";
import { PERMIT_STATUSES, STATUS_LABELS } from "@/domain/enums";
import { PERMIT_TYPES } from "@/domain/permit-types";

export const metadata: Metadata = { title: "Permits" };
export const dynamic = "force-dynamic";

const VIEWS = [
  { value: "", label: "All" },
  { value: "live", label: "Live on site" },
  { value: "expiring", label: "Expiring < 2 h" },
  { value: "my-approvals", label: "Waiting for my sign-off" },
  { value: "mine", label: "Raised by me" },
];

export default async function PermitsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser();
  const raw = await searchParams;
  const filters = permitFiltersSchema.parse(raw);
  const [permits, plants] = await Promise.all([listPermits(user, filters), getReferenceData()]);
  const anyFilter = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">Permits</h1>
          <p className="mt-1 text-ink-muted">
            {permits.length} permit{permits.length === 1 ? "" : "s"}
            {anyFilter ? " match these filters" : " across both plants"}
          </p>
        </div>
        <Link href="/permits/new" className="btn-primary w-full sm:w-auto">
          <Plus aria-hidden />
          Raise a permit
        </Link>
      </div>

      {/* Quick views as large chips */}
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Quick views">
        {VIEWS.map((v) => {
          const active = (filters.view ?? "") === v.value && !filters.status;
          return (
            <Link
              key={v.value}
              href={v.value ? `/permits?view=${v.value}` : "/permits"}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[44px] items-center whitespace-nowrap rounded-full border px-4 text-[15px] font-medium transition-colors duration-out ease-ui ${active ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink-2 hover:border-ink-muted hover:text-ink"}`}
            >
              {v.label}
            </Link>
          );
        })}
      </nav>

      {/* Plain GET form: filters live in the URL, so a filtered list can be bookmarked or shared. */}
      <form className="card grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-12" method="get">
        {filters.view && <input type="hidden" name="view" value={filters.view} />}
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" className="input" placeholder="PTW number, job, contractor" defaultValue={filters.q ?? ""} />
        </div>
        <div className="lg:col-span-3">
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="input" defaultValue={filters.status ?? ""}>
            <option value="">Any</option>
            {PERMIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="label" htmlFor="type">Type</label>
          <select id="type" name="type" className="input" defaultValue={filters.type ?? ""}>
            <option value="">Any</option>
            {PERMIT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-3">
          <label className="label" htmlFor="areaId">Area</label>
          <select id="areaId" name="areaId" className="input" defaultValue={filters.areaId ?? ""}>
            <option value="">Any</option>
            {plants.map((p) => (
              <optgroup key={p.id} label={p.name}>
                {p.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="lg:col-span-3">
          <label className="label" htmlFor="from">From</label>
          <input id="from" name="from" type="date" className="input" defaultValue={filters.from ?? ""} />
        </div>
        <div className="lg:col-span-3">
          <label className="label" htmlFor="to">To</label>
          <input id="to" name="to" type="date" className="input" defaultValue={filters.to ?? ""} />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <button className="btn-secondary">
            <SlidersHorizontal aria-hidden />
            Apply filters
          </button>
          {anyFilter && (
            <Link href="/permits" className="btn-text">
              <X aria-hidden />
              Clear all
            </Link>
          )}
        </div>
      </form>

      {permits.length === 0 ? (
        <PermitRows permits={[]} empty={filters.view === "my-approvals" ? "Nothing is waiting for your sign-off." : "No permits match these filters."} />
      ) : (
        <>
          <div className="hidden lg:block">
            <PermitTable permits={permits} />
          </div>
          <div className="lg:hidden">
            <PermitRows permits={permits} />
          </div>
        </>
      )}
    </div>
  );
}
