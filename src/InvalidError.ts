import { ZodError, ZodIssue } from "zod";

import { GenericError } from "./GenericError.js";

export class InvalidError extends GenericError {
  constructor(code: string, { cause }: { cause: ZodError }) {
    super(code, {
      name: "InvalidError",
      status: 422,
      message: fromZodError(cause.errors),
      cause: cause.errors,
    });
  }
}

const fromZodError = (issues: ZodIssue[]): string =>
  issues
    .slice(0, 8)
    .map(
      ({ path, message }) =>
        `[${path
          .map((v) => (typeof v === "number" ? "[" + v + "]" : v))
          .join(".")}] ${message}`,
    )
    .join("; ");
