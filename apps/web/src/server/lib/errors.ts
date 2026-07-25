/**
 * Machine-readable detail carried alongside an `AppError` so the client can
 * localize a failure without ever rendering `message`.
 *
 * `message` stays **English on purpose** — it is what the agent-facing JSON
 * routes under `app/api/**` return to the Python service, and what `logger` /
 * `recordRequestMetric` record. Only `code` + `details` cross into the UI; see
 * `apps/web/src/i18n/use-action-error.ts` for the resolution order.
 */
export type ErrorDetails = {
  /** Semantic condition → `errors.reason.<reason>` in the message catalog. */
  reason?: string;
  /** Entity noun for `not_found` → `errors.entity.<entity>` in the catalog. */
  entity?: string;
  [key: string]: unknown;
};

/**
 * `"WBS node"` → `"wbsNode"`, `"Project member"` → `"projectMember"`.
 *
 * Lets all ~79 `NotFoundError` call sites keep passing a human entity name
 * (which still forms the English `message`) while yielding a stable catalog
 * key. An entity with no `errors.entity.*` key degrades to the generic
 * not-found copy rather than breaking — so adding a new entity is safe.
 */
function entityKey(entity: string): string {
  return entity
    .trim()
    .split(/[\s_-]+/)
    .map((part, i) =>
      i === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join("");
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: ErrorDetails
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Not authenticated") {
    super(message, "unauthorized", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that", reason?: string) {
    super(message, "forbidden", 403, reason ? { reason } : undefined);
  }
}

export class NotFoundError extends AppError {
  constructor(entity = "Resource") {
    super(`${entity} not found`, "not_found", 404, { entity: entityKey(entity) });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input", reason?: string) {
    super(message, "validation", 422, reason ? { reason } : undefined);
  }
}

/** WP-C5: rate-limit exceeded. `retryAfter` = seconds until the window resets. */
export class RateLimitError extends AppError {
  constructor(
    message = "Too many requests",
    public readonly retryAfter = 60
  ) {
    super(message, "rate_limited", 429);
  }
}

/** WP-D3: optimistic-concurrency conflict — the caller's `version` is stale.
 *  `details` carries the current row + version so the UI can refresh instead
 *  of silently retrying and overwriting a concurrent edit. */
export class ConflictError extends AppError {
  constructor(
    message: string,
    details: { currentVersion: number; current: unknown },
    reason?: string
  ) {
    super(message, "conflict", 409, reason ? { ...details, reason } : details);
  }
}
