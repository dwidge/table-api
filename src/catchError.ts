import { AxiosError } from "axios";

import { ServiceUnavailableError } from "./Error.js";
import { GenericError } from "./GenericError.js";
import { SequelizeError } from "./SequelizeError.js";

export const catchError =
  (code: string, { message = "", data = {} } = {}, Type = GenericError) =>
  (e: unknown) => {
    if (e instanceof GenericError) {
      throw new Type(code, {
        ...e,
        message: message || e.message,
        data: { ...e.data, ...data },
      });
    }
    if (e instanceof Error) {
      throw new Type(code, {
        ...e,
        message: message || e.message,
        stack: e.stack,
        data: { cause: e.cause, ...data },
      });
    }

    console.log(e);
    throw new Type(code, {
      message,
      data,
    });
  };

export const catchSequelize =
  (code: string, cause?: unknown) => (e: unknown) => {
    throw new SequelizeError(code, e, cause);
  };

export const catchAxios = (code: string) => (e: unknown) => {
  if (e instanceof AxiosError) {
    const cause = {
      name: e.name,
      message: e.message,
      request: { url: e.request.url, data: e.request.data },
      response: { data: e.response?.data },
    };

    if (e.status === 503)
      throw new ServiceUnavailableError(code, {
        message: e.message,
        cause,
      });
    else
      throw new GenericError(code, {
        name: "AxiosError",
        message: e.message,
        status: e.response?.status,
        cause,
      });
  } else throw e;
};
