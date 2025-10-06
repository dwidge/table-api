import { ZodError } from "zod";
import { UnprocessableError } from "./Error.js";

export const throwStatus422Unprocessable =
  (code: string) => (cause: unknown) => {
    throw isZodError(cause)
      ? new UnprocessableError(code, {
          cause,
        })
      : cause;
  };

const isZodError = (e: unknown): e is ZodError =>
  e instanceof ZodError || (e instanceof Error && "issues" in e);
