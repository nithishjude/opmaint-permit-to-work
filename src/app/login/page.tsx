import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardCheck, OctagonPause, ScrollText, Timer } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "./login-form";
import { PermitPreview } from "./permit-preview";
import { DEMO_PASSWORD, DEMO_USERS } from "@/server/demo-seed";
import { BrandMark } from "@/components/brand-mark";

export const metadata: Metadata = { title: "Sign in" };

const FACTS = [
  { icon: ClipboardCheck, text: "Two signatures — area owner and safety officer — before work starts" },
  { icon: Timer, text: "Permits expire on their own at the end of the shift window" },
  { icon: OctagonPause, text: "Anyone on the permit can stop work in one tap" },
  { icon: ScrollText, text: "Every change is logged and can never be edited" },
];

// Which plant each demo area owner covers, so the two look different.
const DEMO_SCOPE: Record<string, string> = {
  "owner@ptw.demo": "Chennai areas",
  "owner2@ptw.demo": "Hosur areas",
  "safety@ptw.demo": "Both plants",
  "requester@ptw.demo": "Contractor supervisor",
  "admin@ptw.demo": "Users, areas, equipment",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  const demo = DEMO_USERS.map((u) => ({ email: u.email, name: u.name, role: u.role, scope: DEMO_SCOPE[u.email] }));

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)] xl:grid-cols-[minmax(0,1fr)_460px] 2xl:grid-cols-[minmax(0,1fr)_560px]">
      {/* Product side */}
      <section className="relative hidden overflow-hidden bg-navy text-white lg:flex lg:flex-col">
        {/* faint grid, like a plant drawing */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }}
        />
        <div className="relative flex items-center gap-2.5 px-12 pt-10 text-lg font-semibold">
          <BrandMark className="h-9 w-9" />
          <span>
            Permit to Work
            <span className="block text-[12px] font-medium text-white/50">CMMS · Safety module</span>
          </span>
        </div>

        <div className="relative mx-auto flex w-full max-w-[1040px] flex-1 items-center gap-10 px-12 py-8 2xl:gap-14">
          <div className="max-w-[460px] flex-1 xl:min-w-[380px]">
            <h1 className="text-[38px] font-semibold leading-[1.1] tracking-tight 2xl:text-[44px]">Authorise dangerous work before it starts.</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-white/70">Hot work, confined space, height, electrical isolation and excavation — requested, signed, started and closed in one place.</p>
            <ul className="mt-8 space-y-4">
              {FACTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3 text-[16px] leading-snug text-white/85">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-white/10">
                    <Icon aria-hidden className="h-[18px] w-[18px] text-warning-fill" />
                  </span>
                  <span className="pt-1">{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="hidden shrink-0 justify-center xl:flex">
            <PermitPreview />
          </div>
        </div>

        <p className="relative px-12 pb-8 text-[13px] text-white/45">Chennai Refinery Unit · Hosur Components Plant · all times IST</p>
      </section>

      {/* Sign-in side */}
      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5 text-lg font-semibold">
              <BrandMark className="h-9 w-9" />
              Permit to Work
            </div>
            <p className="mt-3 text-ink-muted">Authorise dangerous work before it starts.</p>
          </div>
          <h2 className="text-[26px] font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-ink-muted">Use your plant account, or pick a demo role below.</p>
          <div className="mt-6">
            <LoginForm next={next && next.startsWith("/") && !next.startsWith("//") ? next : "/"} demoUsers={demo} demoPassword={DEMO_PASSWORD} />
          </div>
        </div>
      </section>
    </main>
  );
}
