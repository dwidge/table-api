import { ServiceUnavailableError } from "./Error.js";
import { GenericError } from "./GenericError.js";

export const catchServiceError =
  (code: string) =>
  (e: unknown): void => {
    if (e instanceof Error && isServiceError(e.message)) {
      console.log(`catchServiceErrorE1: ${code}:`, `${e}`);
      throw new ServiceUnavailableError(code, { cause: e });
    } else throw new GenericError(code, { cause: e });
  };

const isServiceError = (message: string): boolean =>
  [
    "Unauthorized",
    "Service Unavailable",
    "Quota Exceeded",
    "Invalid API Key",
    "Timeout",
  ].some((err) => message.includes(err));
