import { NextResponse } from "next/server";
import { expireDuePermits } from "@/server/permits/expiry";
import { route } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * Scheduled expiry sweep. Vercel Cron calls this with
 * `Authorization: Bearer $CRON_SECRET`; any external pinger can do the same.
 * Safe to call as often as you like — it only touches permits that are due.
 */
export const GET = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Bad cron secret." } }, { status: 401 });
  }
  const expired = await expireDuePermits(new Date());
  return NextResponse.json({ expired, at: new Date().toISOString() });
});
