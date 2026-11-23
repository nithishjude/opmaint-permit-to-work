import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardCheck, OctagonPause, ScrollText, Timer } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "./login-form";
import { DEMO_PASSWORD, DEMO_USERS } from "@/server/demo-seed";
import { BrandMark } from "@/components/brand-mark";

export const metadata: Metadata = { title: "Sign in" };

const FACTS = [
  { icon: ClipboardCheck, text: "Two signatures — area owner and safety officer — before any work starts" },
  { icon: Timer, text: "Permits expire on their own at the end of the shift window" },
  { icon: OctagonPause, text: "Anyone on the permit can stop work in one tap" },
  { icon: ScrollText, text: "Every change is logged and can never be edited" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  const demo = DEMO_USERS.map((u) => ({ email: u.email, name: u.name, role: u.role }));
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_minmax(440px,520px)]">
      <section className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5 text-lg font-semibold">
          <BrandMark className="h-9 w-9" />
          Permit to Work
        </div>
        <div className="max-w-lg">
          <h1 className="text-[40px] font-semibold leading-[1.1] tracking-tight">Authorise dangerous work before it starts.</h1>
          <ul className="mt-8 space-y-4">
            {FACTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-[17px] leading-snug text-white/85">
                <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warning-fill" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[13px] text-white/50">Hot work · Confined space · Working at height · Electrical isolation · Excavation</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5 text-lg font-semibold">
              <BrandMark className="h-9 w-9" />
              Permit to Work
            </div>
            <p className="mt-3 text-ink-muted">Authorise dangerous work before it starts.</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-ink-muted">Use your plant account, or pick a demo role below.</p>
          <div className="mt-6">
            <LoginForm next={next && next.startsWith("/") && !next.startsWith("//") ? next : "/"} demoUsers={demo} demoPassword={DEMO_PASSWORD} />
          </div>
        </div>
      </section>
    </main>
  );
}
