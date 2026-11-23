import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth";
import { getReferenceData } from "@/server/permits/queries";
import { PermitForm } from "@/components/permit-form";

export const metadata: Metadata = { title: "Raise a permit" };
export const dynamic = "force-dynamic";

export default async function NewPermitPage() {
  await requirePageUser();
  const plants = await getReferenceData();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Raise a permit</h1>
      <PermitForm plants={plants} />
    </div>
  );
}
