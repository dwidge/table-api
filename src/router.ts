// Copyright DWJ 2024.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

import {
  getObjectFromQueryString,
  GetQueryOptions,
  getQueryStringFromUrl,
  getValuesFromQueryString,
  toDbQueryOptions,
} from "@dwidge/query-axios-zod";
import { RequestHandler } from "express";

import { ApiItem } from "./ApiItem.js";
import { Auth } from "./Auth.js";
import {
  CartesianLimitExceededError,
  cartesianObject,
} from "./cartesianObject.js";
import { PayloadTooLargeError } from "./Error.js";
import { mapAsync } from "./mapAsync.js";
import { parseItemArray } from "./parseItemArray.js";
import { GetItemList, SetItemList } from "./table.js";
import { throwStatus422Unprocessable } from "./throwStatus422Unprocessable.js";
import { tryCatch } from "./tryCatch.js";
import { ConvertItem } from "./types.js";

export const getItemsRoute =
  <A extends ApiItem>(
    toItem: ConvertItem<A>,
    getItemList: GetItemList<A>,
    authFromToken: (token?: string) => Promise<Auth | undefined>,
  ): RequestHandler =>
  async (req, res) => {
    const auth = await authFromToken(req.headers.authorization);
    const queryString = getQueryStringFromUrl(req.url);
    const query = getObjectFromQueryString(queryString);
    const options = toDbQueryOptions(
      tryCatch(
        () => GetQueryOptions.parse(query),
        throwStatus422Unprocessable("getItemsRouteE1"),
      ),
    );

    const queryForFilters = getValuesFromQueryString(queryString);
    Object.keys(queryForFilters).forEach((key) => {
      if (key.startsWith("_")) {
        delete queryForFilters[key];
      }
    });

    let filterObjects;
    try {
      filterObjects = cartesianObject(queryForFilters, 100);
    } catch (e) {
      if (e instanceof CartesianLimitExceededError) {
        throw new PayloadTooLargeError("getItemsRouteE3", {
          message: e.message,
        });
      }
      throw e;
    }

    const filters = filterObjects.map((filterObject) =>
      tryCatch(
        () => toItem(filterObject as any),
        throwStatus422Unprocessable("getItemsRouteE2"),
      ),
    );
    const columns = Object.keys(queryForFilters) as (keyof A)[];

    const { rows, count, offset } = await getItemList(filters, auth, {
      ...options,
      columns,
    });

    res.appendHeader(
      "Content-Range",
      "items " + offset + "-" + (offset + count - 1) + "/" + count,
    );
    res.status(206).send(rows);
  };

export const setItemsRoute =
  <A extends ApiItem>(
    toItem: ConvertItem<A>,
    setItemList: SetItemList<A>,
    authFromToken: (token?: string) => Promise<Auth | undefined>,
    hook?: (rows: (A | null)[]) => Promise<(A | null)[]>,
    preHook?: (row: A) => Promise<A>,
  ): RequestHandler =>
  async (req, res) => {
    const inputItems = tryCatch(
      () => parseItemArray(toItem, req.body),
      throwStatus422Unprocessable("setItemsRouteE1"),
    );
    const rows = await setItemList(
      await mapAsync(preHook ?? (async (v) => v), inputItems),
      await authFromToken(req.headers.authorization),
    );

    const newRows = hook ? await hook(rows) : rows;

    res.json(newRows);
  };

export const delItemsRoute = setItemsRoute;
