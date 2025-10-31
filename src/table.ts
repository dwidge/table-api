import {
  assert,
  DbQueryOptions,
  dropUndefined,
  hasUndefined,
} from "@dwidge/query-axios-zod";
import { Expand, randInt50 } from "@dwidge/randid";
import { traceAsync } from "@dwidge/trace-js";
import { asyncMap, topologicalSortItems } from "@dwidge/utils-js";
import {
  ForeignKeyConstraintError,
  Model,
  ModelStatic,
  Op,
  Order,
  UniqueConstraintError,
  WhereOptions,
} from "sequelize";
import { z } from "zod";

import { ApiItem, ApiItemDb } from "./ApiItem.js";
import { Auth } from "./Auth.js";
import { catchSequelize } from "./catchError.js";
import { ConflictError, ForbiddenError, NotFoundError } from "./Error.js";
import { GenericError } from "./GenericError.js";
import { findMissingForeignKeys } from "./getSequelizeErrorData.js";
import { OnBatchSet } from "./OnBatchSet.js";
import { SequelizeError } from "./SequelizeError.js";
import { ConvertItem } from "./types.js";
import { unixTimestamp } from "./unixTimestamp.js";

export type CanUserReadItem<D extends ApiItemDb> = (
  item: D,
  auth?: Auth,
) => boolean;
export type CanUserWriteItem<D extends ApiItemDb> = (
  item: D,
  auth?: Auth,
) => boolean;

export type GetItemList<A> = (
  filter: Partial<A> | Partial<A>[],
  auth?: Auth,
  options?: DbQueryOptions & { columns?: (keyof A)[] },
) => Promise<{ rows: A[]; count: number; offset: number }>;
export type SetItemList<A extends ApiItem> = (
  items: A[],
  auth?: Auth,
  postHook?: OnBatchSet<A>,
) => Promise<(A | null)[]>;
export type DetItemList<A extends ApiItem> = (
  items: A[],
  auth?: Auth,
  postHook?: OnBatchSet<A>,
) => Promise<(A | null)[]>;

type FindAndCountAll = <T>(options: {
  where: T;
  attributes?: string[];
  offset?: number;
  limit?: number;
  order?: string[][];
}) => Promise<{ rows: T[]; count: number }>;
type Upsert = <T>(item: T) => Promise<[T | null]>;

type CoalesceDefined<A, B> = A extends undefined ? B : A;
type Defined<T> = CoalesceDefined<T, never>;

type FilterSomeKeys<T, A> = {
  [K in keyof A]: K extends keyof T
    ? CoalesceDefined<A[K], Defined<T[K]>>
    : never;
};
type FilterAllKeys<T, A> = {
  [K in keyof T]: K extends keyof A ? CoalesceDefined<A[K], T[K]> : T[K];
};

export type HasUndefined<T> = keyof {
  [K in keyof T as undefined extends T[K] ? K : never]: T[K];
} extends never
  ? false
  : true;

type AA = HasUndefined<{ a: 1; v: 1 }> extends true ? 1 : 2;

type FilterKeys<T, A> =
  HasUndefined<A> extends true ? FilterSomeKeys<T, A> : FilterAllKeys<T, A>;

const mustNotAddKeysNotInInput = <A extends {}, B extends {}>(
  toItem: ConvertItem<A, B>,
) =>
  assert(
    Object.keys(dropUndefined(toItem({} as B))).length === 0,
    new Error("mustNotAddKeysNotInInputE1: " + Object.keys(toItem({} as B))),
  );

export const useItemDb = <A extends ApiItem, D extends ApiItemDb>(
  toItem: ConvertItem<D>,
  toApiItem: ConvertItem<Partial<A>, D>,
  toDbItem: ConvertItem<D, Partial<A>>,
  model: ModelStatic<Model<D, D>>,
  randId?: () => number,
  toApiItemExtra?: (
    v: D,
    columns?: (keyof A)[],
    auth?: Auth,
  ) => Partial<A> | Promise<Partial<A>>,
  canUserReadItem?: CanUserReadItem<D>,
  canUserWriteItem?: CanUserWriteItem<D>,
) => ({
  getList: getItemListType(
    toItem,
    toApiItemExtra ?? toApiItem,
    toDbItem,
    model,
    canUserReadItem,
  ) as GetItemList<A>,
  setList: setItemListType(
    toItem,
    toApiItem,
    toDbItem,
    model,
    randId,
    canUserWriteItem,
  ),
  delList: delItemListType(
    toItem,
    toApiItem,
    toDbItem,
    model,
    randId,
    canUserWriteItem,
  ),
});

export const getItemListType = <A extends ApiItem, D extends ApiItemDb>(
  toItem: ConvertItem<D>,
  toApiItem: (
    v: D,
    columns?: (keyof A)[],
    auth?: Auth,
  ) => Partial<A> | Promise<Partial<A>>,
  toDbItem: ConvertItem<D, Partial<A>>,
  model: ModelStatic<Model<D, D>>,
  canUserReadItem?: CanUserReadItem<D>,
) => (
  mustNotAddKeysNotInInput(toItem),
  mustNotAddKeysNotInInput(toApiItem),
  mustNotAddKeysNotInInput(toDbItem),
  traceAsync(
    "getItemListTypeE1",
    async <T extends Partial<A>>(
      filter: T | T[],
      auth?: Auth,
      options?: DbQueryOptions & { columns?: (keyof A)[] },
    ): Promise<{
      rows: Expand<FilterKeys<A, T>>[];
      count: number;
      offset: number;
    }> => {
      assert(
        !Object.hasOwn(toDbItem({}), "deletedAt"),
        new GenericError(
          "getItemListTypeE2: toDbItem() must not add { deletedAt: undefined }: " +
            model.name,
          { data: toDbItem({}) },
        ),
      );

      const { rows, count, offset } = await getItemList(
        toItem,
        model,
        (Array.isArray(filter) ? filter : [filter]).map(toDbItem),
        auth,
        options,
        canUserReadItem,
      );
      return {
        rows: (
          await asyncMap(rows, (v) => toApiItem(v, options?.columns, auth))
        ).map(dropUndefined) as any[],
        count,
        offset,
      };
    },
  )
);

export const getItemListType2 = <A extends ApiItem, D extends ApiItemDb>(
  toItem: ConvertItem<D>,
  toApiItem: (
    columns: (keyof A)[],
    auth?: Auth,
  ) => ConvertItem<Partial<A> | Promise<Partial<A>>, D>,
  toDbItem: (auth?: Auth) => ConvertItem<D | Promise<D>, Partial<A>>,
  model: ModelStatic<Model<D, D>>,
  canUserReadItem?: CanUserReadItem<D>,
) => (
  mustNotAddKeysNotInInput(toItem),
  traceAsync(
    "getItemListType2E",
    async <T extends Partial<A>>(
      filter: T | T[],
      auth?: Auth,
      options?: DbQueryOptions,
    ): Promise<{
      rows: Expand<FilterKeys<A, T>>[];
      count: number;
      offset: number;
    }> => {
      assert(
        !Object.hasOwn(toDbItem(auth)({}), "deletedAt"),
        new GenericError(
          "getItemListType2E2: toDbItem() must not add { deletedAt: undefined }: " +
            model.name,
          { data: toDbItem(auth)({}) },
        ),
      );

      const columns = Object.keys(filter) as (keyof A)[];
      mustNotAddKeysNotInInput(toApiItem(columns, auth));
      mustNotAddKeysNotInInput(toDbItem(auth));
      const { rows, count, offset } = await getItemList(
        toItem,
        model,
        await asyncMap(
          Array.isArray(filter) ? filter : [filter],
          toDbItem(auth),
        ),
        auth,
        options,
        canUserReadItem,
      );
      return {
        rows: (await asyncMap(rows, toApiItem(columns, auth))).map(
          dropUndefined,
        ) as any[],
        count,
        offset,
      };
    },
  )
);

export async function getItemList<D extends ApiItemDb>(
  toItem: ConvertItem<D>,
  model: ModelStatic<Model<D>>,
  filter: D[],
  auth?: Auth,
  options?: DbQueryOptions,
  canUserReadItem: CanUserReadItem<D> = canUserReadItemDefault,
): Promise<{ rows: D[]; count: number; offset: number }> {
  auth = Auth.optional().parse(auth);
  const {
    offset = 0,
    limit = 1000,
    order = [],
    from,
    history,
  } = DbQueryOptions.optional().parse(options) ?? {};

  const userFilter = filter
    .map((f) => dropUndefined(toItem(f)))
    .filter((f) => Object.entries(f).length);
  const userWhere = userFilter.length
    ? {
        [Op.or]: userFilter,
      }
    : {};

  const authWhere = (
    auth?.CompanyId
      ? { [Op.or]: [{ companyId: auth.CompanyId }, { companyId: null }] }
      : {}
  ) as WhereOptions<D>;

  const fromWhere = (
    from !== undefined ? { updatedAt: { [Op.gte]: from } } : {}
  ) as WhereOptions<D>;

  const historyWhere = (
    history === undefined ? { deletedAt: null } : {}
  ) as WhereOptions<D>;

  const where = {
    [Op.and]: [userWhere, authWhere, fromWhere, historyWhere],
  };

  let attributes = filter.some(hasUndefined)
    ? ["id", "companyId", ...filter.flatMap((f) => Object.keys(f))]
    : undefined;

  const findcount = await model
    .findAndCountAll({
      where,
      offset,
      limit,
      order: order as Order,
    })
    .catch(catchSequelize("getItemListE1"));

  const allowed = findcount.rows
    .map((v) => toItem(v.toJSON()))
    .filter((v) => canUserReadItem(v, auth));

  assert(
    toItem({ deletedAt: null } as Partial<D>).deletedAt === null,
    "getItemListE3: toItem() must preserve { deletedAt: null }",
  );
  assert(
    dropUndefined({ deletedAt: null } as Partial<D>).deletedAt === null,
    "getItemListE4: dropUndefined() must preserve { deletedAt: null }",
  );

  const enableReturnDeletedItems =
    filter.some((v) => Object.hasOwn(v, "deletedAt")) ||
    options?.history !== undefined;
  const includesDeletedItems = allowed.some((v) => v.deletedAt !== null);
  if (!enableReturnDeletedItems && includesDeletedItems) {
    console.log(
      "getItemListE51",
      toItem({} as Partial<D>),
      Object.keys(toItem({} as Partial<D>)),
      where,
      allowed,
    );
    throw new Error(
      "getItemListE5: Getting deleted items but not asking for them in the filter",
    );
  }

  return {
    rows: allowed,
    count: findcount.count,
    offset,
  };
}

function flattenArrayToObject<T extends object>(
  array: T[],
): { [K in keyof T]: T[K][] } {
  return array.reduce(
    (acc, obj) => {
      (Object.keys(obj) as (keyof T)[]).forEach((key) => {
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(obj[key]);
      });
      return acc;
    },
    {} as { [K in keyof T]: T[K][] },
  );
}

export const setItemListType = <A extends ApiItem, D extends ApiItemDb>(
  toItem: ConvertItem<D>,
  toApiItem: ConvertItem<A, D>,
  toDbItem: ConvertItem<D, A>,
  model: ModelStatic<Model<D>>,
  randId?: () => number,
  canUserWriteItem?: CanUserWriteItem<D>,
) => (
  mustNotAddKeysNotInInput(toItem),
  mustNotAddKeysNotInInput(toApiItem),
  mustNotAddKeysNotInInput(toDbItem),
  async (items: A[], auth?: Auth, postHook?: OnBatchSet<A>) => {
    const dbItems = await z.any().array().parse(items).map(toDbItem);

    const results = await setItemList(
      toItem,
      model,
      dbItems,
      auth,
      randId,
      canUserWriteItem,
    );

    return await logAndReturnResults<A, D>(
      results,
      model,
      items,
      toApiItem,
      postHook,
    );
  }
);

const convertErrorData = <A extends ApiItem, D extends ApiItemDb>(
  toApiItem: ConvertItem<A, D>,
  e: GenericError,
): GenericError => {
  if (e.data?.value) e.data.value = toApiItem(e.data.value);
  if (e.data?.missing) e.data.missing = toApiItem(e.data.missing);
  return e;
};

export const delItemListType = <A extends ApiItem, D extends ApiItemDb>(
  toItem: ConvertItem<D>,
  toApiItem: ConvertItem<A, D>,
  toDbItem: ConvertItem<D, A>,
  model: ModelStatic<Model<D>>,
  randId?: () => number,
  canUserWriteItem?: CanUserWriteItem<D>,
) => (
  mustNotAddKeysNotInInput(toItem),
  mustNotAddKeysNotInInput(toApiItem),
  mustNotAddKeysNotInInput(toDbItem),
  async (items: A[], auth?: Auth, postHook?: OnBatchSet<A>) => {
    const dbItems = await z
      .any()
      .array()
      .parse(items)
      .map(toDbItem)
      .map((v) => ({ ...v, deletedAt: unixTimestamp() }));

    const results = await setItemList(
      toItem,
      model,
      dbItems,
      auth,
      randId,
      canUserWriteItem,
    );

    return await logAndReturnResults<A, D>(
      results,
      model,
      items,
      toApiItem,
      postHook,
    );
  }
);

export const setItemList = async <A extends ApiItem, D extends ApiItemDb>(
  toItem: ConvertItem<D>,
  model: ModelStatic<Model<D>>,
  items: D[],
  auth?: Auth,
  randId?: () => number,
  canUserWriteItem?: CanUserWriteItem<D>,
): Promise<{ value?: D | null; error?: unknown }[]> =>
  asyncMap(topologicalSortItems(items), (item) =>
    setItem(toItem, model, item, auth, randId, canUserWriteItem)
      .then((value) => ({ value }))
      .catch((error) => ({ error })),
  );

export const onBatchThrowFirstError = async <A extends ApiItem>(
  table,
  items,
  results,
) => {
  const errors = results.filter((v) => v.error).map((v) => v.error);

  if (errors.length === 0) return;

  const [firstError] = errors;
  throw firstError;
};

async function logAndReturnResults<A extends ApiItem, D extends ApiItemDb>(
  results: { value?: D | null | undefined; error?: unknown }[],
  model: ModelStatic<Model<D, D>>,
  dbItems: A[],
  toApiItem: ConvertItem<A, D>,
  onBatchSet: OnBatchSet<A> = onBatchThrowFirstError,
) {
  await onBatchSet(
    model.name,
    dbItems,
    results.map(({ value, error }) => ({
      value: value ? toApiItem(value) : value,
      error:
        error instanceof GenericError
          ? convertErrorData(toApiItem, error)
          : error,
    })),
  );

  return results.map((v) =>
    v.value ? dropUndefined(toApiItem(v.value)) : null,
  );
}

export async function setItem<D extends ApiItemDb>(
  toItem: ConvertItem<D>,
  model: ModelStatic<Model<D>>,
  partial: D,
  auth?: Auth,
  randId = () => randInt50(),
  canUserWriteItem: CanUserWriteItem<D> = canUserWriteItemDefault,
): Promise<D | null> {
  auth = Auth.optional().parse(auth);

  const id = partial.id;
  const old =
    id != null
      ? (
          await model
            .findOne({
              where: dropUndefined({ id }) as WhereOptions<D>,
            })
            .catch(catchSequelize("setItemE1"))
        )?.toJSON()
      : undefined;

  if (old && !canUserWriteItem(old, auth))
    throw new ForbiddenError("setItemE2", {
      data: {
        item: { companyId: old.companyId },
        auth: { companyId: auth?.CompanyId },
      },
    });

  const write = dropUndefined(
    toItem({
      id: randId(),
      ...dropUndefined({ ...old, ...partial }),
      updatedAt: unixTimestamp(),
      authorId: auth?.id,
    }),
  );

  if (!canUserWriteItem(write, auth))
    throw new ForbiddenError("setItemE3", {
      data: {
        item: { companyId: write.companyId },
        auth: { companyId: auth?.CompanyId },
      },
    });

  try {
    const result = old
      ? (await model
          .update(write as any, {
            where: { id: old.id } as WhereOptions<D>,
          })
          .catch(catchSequelize2("setItemE4", model, write)),
        write)
      : (
          await model
            .create({
              createdAt: unixTimestamp(),
              ...write,
            } as any)
            .catch(catchSequelize2("setItemE5", model, write))
        ).toJSON();
    assert(result, "setItemE6");

    const key = result;
    assert(key.id === write.id, "setItemE7");

    return dropUndefined(toItem({ id: key.id } as Partial<D>));
  } catch (e) {
    if (e instanceof NotFoundError) {
      throw new NotFoundError(
        "setItemE8: Could not create item, missing foreign key, ignoring item, returning empty",
        { message: e.message, cause: e.cause },
      );
    } else throw e;
  }
}

const catchSequelize2 =
  <D extends ApiItemDb>(
    code: string,
    model: ModelStatic<Model<D>>,
    value: object,
  ) =>
  async (error: unknown) => {
    if (error instanceof UniqueConstraintError) {
      throw new ConflictError(code, { value });
    } else if (error instanceof ForeignKeyConstraintError) {
      const missing = await findMissingForeignKeys(model, value);
      throw new NotFoundError(code, { cause: { missing, value } });
    } else throw new SequelizeError(code, error, { value });
  };

const canUserReadItemDefault = <D extends ApiItemDb>(
  item: D,
  auth?: Auth,
): boolean =>
  !auth || item.companyId === null || item.companyId === auth.CompanyId;

const canUserWriteItemDefault = <D extends ApiItemDb>(
  item: D,
  auth?: Auth,
): boolean =>
  !auth || (item.companyId !== null && item.companyId === auth.CompanyId);
