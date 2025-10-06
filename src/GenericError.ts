import { cleanStackTraceNode } from "@dwidge/trace-js";

export interface GenericError {
  code: string;
  name: string;
  message: string;
  status: number;
  stack: string;
  data?: any;
}

export class GenericError extends Error implements GenericError {
  code: string;
  status: number;
  data?: any;
  constructor(
    code: string,
    {
      name = "GenericError",
      message,
      status = 500,
      stack,
      data,
      cause,
    }: {
      name?: string;
      message?: string;
      status?: number;
      stack?: string;
      data?: any;
      cause?: unknown;
    } = {},
  ) {
    super(message ? code + ": " + message : code, { cause });
    this.code = code;
    this.name = name;
    this.status = status;
    this.data = data;

    if (stack) this.stack = stack;
    else Error.captureStackTrace(this, this.constructor);
    this.stack = cleanStackTraceNode(this.stack);
  }

  toJSON() {
    return {
      code: this.code,
      name: this.name,
      message: this.message,
      status: this.status,
      stack: this.stack,
      data: this.data,
      cause: this.cause,
    };
  }

  toString() {
    return (
      `${this.name} (${this.code}): ${this.message}` +
      (this.status ? `\nStatus: ${this.status}` : "") +
      (this.data ? `\nData: ${JSON.stringify(this.data)}` : "") +
      (this.cause ? `\nCause: ${JSON.stringify(this.cause)}` : "") +
      (this.stack ? `\nStack: ${this.stack}` : "")
    );
  }
}
