import { login } from "@/server/auth";
import { loginSchema } from "@/server/api-schemas";
import { ok, parseBody, route } from "@/server/http";

export const POST = route(async (req) => {
  const { email, password } = await parseBody(req, loginSchema);
  const user = await login(email, password);
  return ok({ user: { id: user.id, name: user.name, role: user.role } });
});
