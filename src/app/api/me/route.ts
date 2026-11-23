import { requireUser } from "@/server/auth";
import { ok, route } from "@/server/http";

export const GET = route(async () => ok({ user: await requireUser() }));
