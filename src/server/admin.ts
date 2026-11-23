// Admin-only master data: users, plants, areas (with their owner), equipment.
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./db";
import { DomainError } from "@/domain/errors";
import { ROLES } from "@/domain/enums";
import type { Actor } from "@/domain/permissions";

export function assertAdmin(actor: Actor) {
  if (actor.role !== "ADMIN") throw new DomainError("FORBIDDEN", "Admins only.");
}

const code = z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9-]+$/, "Letters, digits and dashes only");

export const adminSchemas = {
  createUser: z.object({
    email: z.string().trim().toLowerCase().email(),
    name: z.string().trim().min(2).max(100),
    role: z.enum(ROLES),
    password: z.string().min(8, "At least 8 characters").max(200),
  }),
  updateUser: z.object({ role: z.enum(ROLES).optional(), active: z.boolean().optional() }),
  createPlant: z.object({ code, name: z.string().trim().min(2).max(100), location: z.string().trim().max(200).optional() }),
  createArea: z.object({ plantId: z.string().min(1), code, name: z.string().trim().min(2).max(100), ownerId: z.string().min(1).nullable().optional() }),
  updateArea: z.object({ ownerId: z.string().min(1).nullable() }),
  createEquipment: z.object({ areaId: z.string().min(1), tag: code, name: z.string().trim().min(2).max(150) }),
};

async function assertOwnerCandidate(ownerId: string | null | undefined) {
  if (!ownerId) return;
  const u = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!u || u.role !== "AREA_OWNER" || !u.active) throw new DomainError("VALIDATION_FAILED", "Area owner must be an active user with the Area Owner role.");
}

function uniqueViolation(e: unknown, what: string): never {
  if ((e as { code?: string }).code === "P2002") throw new DomainError("VALIDATION_FAILED", `${what} already exists.`);
  throw e;
}

export async function createUser(actor: Actor, input: z.infer<typeof adminSchemas.createUser>) {
  assertAdmin(actor);
  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.user
    .create({ data: { email: input.email, name: input.name, role: input.role, passwordHash }, select: { id: true, email: true, name: true, role: true } })
    .catch((e) => uniqueViolation(e, "A user with that email"));
}

export async function updateUser(actor: Actor, id: string, input: z.infer<typeof adminSchemas.updateUser>) {
  assertAdmin(actor);
  if (id === actor.id && (input.active === false || (input.role && input.role !== "ADMIN")))
    throw new DomainError("VALIDATION_FAILED", "You can't demote or deactivate yourself.");
  if (input.role && input.role !== "AREA_OWNER") {
    const owned = await prisma.area.count({ where: { ownerId: id } });
    if (owned) throw new DomainError("VALIDATION_FAILED", `This user owns ${owned} area(s). Reassign them before changing the role.`);
  }
  return prisma.user.update({ where: { id }, data: input, select: { id: true, role: true, active: true } });
}

export async function createPlant(actor: Actor, input: z.infer<typeof adminSchemas.createPlant>) {
  assertAdmin(actor);
  return prisma.plant.create({ data: { ...input, code: input.code.toUpperCase() } }).catch((e) => uniqueViolation(e, "A plant with that code"));
}

export async function createArea(actor: Actor, input: z.infer<typeof adminSchemas.createArea>) {
  assertAdmin(actor);
  await assertOwnerCandidate(input.ownerId);
  return prisma.area.create({ data: { ...input, code: input.code.toUpperCase(), ownerId: input.ownerId ?? null } }).catch((e) => uniqueViolation(e, "An area with that code in this plant"));
}

export async function updateArea(actor: Actor, id: string, input: z.infer<typeof adminSchemas.updateArea>) {
  assertAdmin(actor);
  await assertOwnerCandidate(input.ownerId);
  return prisma.area.update({ where: { id }, data: { ownerId: input.ownerId } });
}

export async function createEquipment(actor: Actor, input: z.infer<typeof adminSchemas.createEquipment>) {
  assertAdmin(actor);
  return prisma.equipment.create({ data: { ...input, tag: input.tag.toUpperCase() } }).catch((e) => uniqueViolation(e, "Equipment with that tag"));
}

export async function adminOverview() {
  const [users, plants] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, email: true, name: true, role: true, active: true, _count: { select: { ownedAreas: true } } } }),
    prisma.plant.findMany({
      orderBy: { name: "asc" },
      include: { areas: { orderBy: { name: "asc" }, include: { owner: { select: { id: true, name: true } }, equipment: { orderBy: { tag: "asc" } } } } },
    }),
  ]);
  return { users, plants };
}
