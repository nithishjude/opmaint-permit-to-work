import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { Prisma } from "@prisma/client";
import { DomainError } from "@/domain/errors";

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/**
 * Wraps every API route: domain errors become JSON with the right status,
 * validation errors become 422 with field paths, anything else is a logged 500
 * that never leaks a stack trace.
 */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof DomainError) {
    return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.httpStatus });
  }
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: issues.map((i) => (i.field ? `${i.field}: ${i.message}` : i.message)).join("; "), details: issues } },
      { status: 422 },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found." } }, { status: 404 });
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong on our side." } }, { status: 500 });
}

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new DomainError("VALIDATION_FAILED", "Request body must be valid JSON.");
  }
  return schema.parse(raw);
}

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
