import Link from "next/link";
import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth";
import { getReferenceData, listPermits, permitFiltersSchema } from "@/server/permits/queries";
import { PermitRows } from "@/components/permit-list";
import { PERMIT_STATUSES, STATUS_LABELS } from "@/domain/enums";
import { PERMIT_TYPES } from "@/domain/permit-types";

export const metadata: Metadata = { title: "Permits" };
export const dynamic = "force-dynamic";

const VIEWS = [
  { value: "", label: "All" },
  { value: "live", label: "Live (approved / active / suspended)" },
  { value: "expiring", label: "Expiring < 2 h" },
  { value: "my-approvals", label: "My approvals pending" },
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-black">Permits</h1>
        <Link href="/permits/new" className="btn-primary">
          + Raise a permit
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
              className={`flex min-h-[44px] items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold ring-1 ring-inset ${active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-800 ring-slate-300 hover:ring-slate-500"}`}
            >
              {v.label}
            </Link>
          );
        })}
      </nav>

      {/* Plain GET form: filters live in the URL, so a filtered list can be bookmarked or shared. */}
      <form className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" method="get">
        {filters.view && <input type="hidden" name="view" value={filters.view} />}
        <div className="lg:col-span-2">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" className="input" placeholder="PTW number, job, contractor" defaultValue={filters.q ?? ""} />
        </div>
        <div>
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
        <div>
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
        <div className="lg:col-span-2">
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
        <div>
          <label className="label" htmlFor="from">From</label>
          <input id="from" name="from" type="date" className="input" defaultValue={filters.from ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="to">To</label>
          <input id="to" name="to" type="date" className="input" defaultValue={filters.to ?? ""} />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button className="btn-primary">Apply filters</button>
          {anyFilter && (
            <Link href="/permits" className="btn-secondary">
              Clear
            </Link>
          )}
          <span className="ml-auto self-center text-sm text-slate-600">{permits.length} permit{permits.length === 1 ? "" : "s"}</span>
        </div>
      </form>

      <PermitRows permits={permits} empty={filters.view === "my-approvals" ? "Nothing is waiting for your approval. 👍" : "No permits match these filters."} />
    </div>
  );
}
