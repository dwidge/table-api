import { GenericError } from "./GenericError.js";

export class SequelizeError extends GenericError {
  constructor(code: string, e: any, cause?: unknown) {
    super(code, {
      name: "SequelizeError",
      status: 500,
      stack: e.stack,
      message: e.original?.message ?? e.message,
      data: { cause, name: e.name, sql: e.sql, original: e.original },
    });
  }
}
