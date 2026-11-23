import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "./login-form";
import { DEMO_PASSWORD, DEMO_USERS } from "@/server/demo-seed";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  const demo = DEMO_USERS.map((u) => ({ email: u.email, name: u.name, role: u.role }));
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500 text-3xl text-slate-900">⚠</div>
          <h1 className="text-2xl font-black">Permit to Work</h1>
          <p className="text-slate-300">Authorise dangerous work before it starts.</p>
        </div>
        <LoginForm next={next && next.startsWith("/") && !next.startsWith("//") ? next : "/"} demoUsers={demo} demoPassword={DEMO_PASSWORD} />
      </div>
    </main>
  );
}
