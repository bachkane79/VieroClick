export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
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
