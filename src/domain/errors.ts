// A single error type for every rule the domain enforces. API routes turn it
// into a JSON body `{ error: { code, message, details? } }` with `httpStatus`.

export type DomainErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "PRECONDITION_FAILED"
  | "VALIDATION_FAILED"
  | "CONCURRENT_MODIFICATION";

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  PRECONDITION_FAILED: 409,
  VALIDATION_FAILED: 422,
  CONCURRENT_MODIFICATION: 409,
};

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: DomainErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = STATUS_BY_CODE[code];
    this.details = details;
  }
}
