import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { DomainError } from "@/domain/errors";
import type { Actor } from "@/domain/permissions";
import type { Role } from "@/domain/enums";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./session-token";

export interface CurrentUser extends Actor {
  name: string;
  email: string;
}

/**
 * The JWT only carries the user id. Role and area ownership are re-read from
 * the database on every request, so demoting a user or reassigning an area
 * takes effect immediately rather than when their token expires.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const userId = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { ownedAreas: { select: { id: true } } },
  });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    ownedAreaIds: user.ownedAreas.map((a) => a.id),
  };
}

/** For API routes: throws 401. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new DomainError("UNAUTHENTICATED", "Please sign in.");
  return u;
}

/** For pages: redirects to /login. */
export async function requirePageUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

let DUMMY_HASH: string | undefined;

export async function login(email: string, password: string): Promise<CurrentUser> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Always run bcrypt so response time doesn't reveal whether the email exists.
  const hash = user?.passwordHash ?? (DUMMY_HASH ??= await bcrypt.hash("timing-equaliser", 10));
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok || !user.active) throw new DomainError("UNAUTHENTICATED", "Wrong email or password.");

  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return { id: user.id, name: user.name, email: user.email, role: user.role as Role, ownedAreaIds: [] };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
