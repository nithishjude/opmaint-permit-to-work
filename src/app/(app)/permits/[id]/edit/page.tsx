import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DomainError } from "@/domain/errors";
import { requirePageUser } from "@/server/auth";
import { getPermitDetail, getReferenceData } from "@/server/permits/queries";
import { asPrecautions, asTypeData } from "@/server/permits/repository";
import { PermitForm } from "@/components/permit-form";
import { TypeBadge } from "@/components/badges";

export const metadata: Metadata = { title: "Edit draft" };
export const dynamic = "force-dynamic";

export default async function EditPermitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  let detail;
  try {
    detail = await getPermitDetail(user, id);
  } catch (e) {
    if (e instanceof DomainError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { permit, actions } = detail;
  const plants = await getReferenceData();
  // Only drafts are editable, and only by whoever may edit them; otherwise show the permit.
  if (!actions.includes("EDIT_DRAFT")) redirect(`/permits/${id}`);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">Edit draft {permit.number}</h1>
        <TypeBadge type={permit.type} />
      </div>
      <PermitForm
        plants={plants}
        initial={{
          id: permit.id,
          type: permit.type,
          contractor: permit.contractor,
          crewSize: permit.crewSize,
          workDescription: permit.workDescription,
          areaId: permit.areaId,
          equipmentId: permit.equipmentId,
          locationDetail: permit.locationDetail,
          plannedStart: permit.plannedStart.toISOString(),
          plannedEnd: permit.plannedEnd.toISOString(),
          hazards: permit.hazards,
          ppe: permit.ppe,
          precautions: asPrecautions(permit.precautions),
          typeData: asTypeData(permit.typeData),
        }}
      />
    </div>
  );
}
