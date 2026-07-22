export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown
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
  constructor(message = "You do not have permission to do that") {
    super(message, "forbidden", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(entity = "Resource") {
    super(`${entity} not found`, "not_found", 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input") {
    super(message, "validation", 422);
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
  constructor(message: string, details: { currentVersion: number; current: unknown }) {
    super(message, "conflict", 409, details);
  }
}
