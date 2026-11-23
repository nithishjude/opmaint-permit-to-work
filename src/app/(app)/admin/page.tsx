import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/server/auth";
import { adminOverview } from "@/server/admin";
import { AdminPanel } from "./admin-panel";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requirePageUser();
  if (user.role !== "ADMIN") redirect("/");
  const data = await adminOverview();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Admin</h1>
      <AdminPanel data={data} currentUserId={user.id} demoMode={process.env.DEMO_MODE === "true"} />
    </div>
  );
}
