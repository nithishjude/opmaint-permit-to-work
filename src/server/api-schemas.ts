// Request body schemas for the REST API. The domain re-validates anything
// safety-relevant, these just make sure the shape is right.
import { z } from "zod";
import { MAX_EXTENSION_HOURS } from "@/domain/guards";

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});

export const transitionSchema = z.object({
  action: z.enum(["SUBMIT", "ACTIVATE", "SUSPEND", "RESUME", "CLOSE", "VERIFY", "CANCEL"]),
  comment: z.string().trim().max(2000).nullish(),
  completionNotes: z.string().trim().max(4000).nullish(),
  verificationNotes: z.string().trim().max(4000).nullish(),
});

// ~300 KB is plenty for a PNG signature from a phone canvas.
const signature = z
  .string()
  .max(400_000, "Signature image is too large.")
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Signature must be a PNG data URL.");

export const approvalSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE"), comment: z.string().trim().max(2000).nullish(), signature }),
  z.object({ decision: z.literal("REJECT"), comment: z.string().trim().min(5, "Give a reason (at least 5 characters).").max(2000), signature: z.null().optional() }),
]);

export const readingsSchema = z.object({
  typeData: z.record(z.unknown()),
  comment: z.string().trim().max(2000).nullish(),
});

export const workLogSchema = z.object({
  kind: z.enum(["NOTE", "ENTRY", "EXIT"]),
  person: z.string().trim().max(120).nullish(),
  message: z.string().trim().min(1, "Message is required.").max(2000),
});

export const extensionRequestSchema = z.object({
  hours: z.number().int().min(1).max(MAX_EXTENSION_HOURS),
  reason: z.string().trim().min(5, "Give a reason (at least 5 characters).").max(1000),
});

export const extensionDecisionSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(1000).nullish(),
});

export const conflictQuerySchema = z.object({
  type: z.string().min(1),
  areaId: z.string().min(1),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  excludeId: z.string().optional(),
});
