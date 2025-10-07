import { GenericError } from "./GenericError.js";

export class NotAuthorizedError extends GenericError {
  constructor(
    code,
    {
      stack = "",
      data = undefined as object | undefined,
      message = "Not Authorized",
    } = {},
  ) {
    super(code, {
      name: "NotAuthorized",
      status: 401,
      message,
      stack,
      data,
    });
  }
}

export class ForbiddenError extends GenericError {
  constructor(
    code,
    { stack = "", data = undefined, message = "Forbidden" } = {},
  ) {
    super(code, {
      name: "Forbidden",
      status: 403,
      message,
      stack,
      data,
    });
  }
}

export class ServiceUnavailableError extends GenericError {
  constructor(
    code,
    {
      stack = "",
      data = undefined,
      message = "Service Unavailable",
      cause = undefined as unknown,
    } = {},
  ) {
    super(code, {
      name: "ServiceUnavailable",
      status: 503,
      message,
      stack,
      data,
      cause,
    });
  }
}

export class NotFoundError extends GenericError {
  constructor(
    code = "",
    {
      data = undefined,
      name = "NotFoundError",
      status = 404,
      message = "Not Found",
      cause = undefined as unknown,
    } = {},
  ) {
    super(code, {
      data,
      name,
      status,
      message,
      cause,
    });
  }
}

export class ConflictError extends GenericError {
  constructor(code, data?: object) {
    super(code, {
      data,
      name: "ConflictError",
      status: 409,
      message: "Already exists",
    });
  }
}

export class UnprocessableError extends GenericError {
  constructor(code, data?: object, { stack = "" } = {}) {
    super(code, {
      data,
      stack,
      name: "Unprocessable",
      status: 422,
      message: "Unprocessable",
    });
  }
}

export class PayloadTooLargeError extends GenericError {
  constructor(
    code,
    {
      stack = "",
      data = undefined as object | undefined,
      message = "Payload Too Large",
    } = {},
  ) {
    super(code, {
      name: "PayloadTooLarge",
      status: 413,
      message,
      stack,
      data,
    });
  }
}
