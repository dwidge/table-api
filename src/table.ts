import {
  DbQueryOptions,
  dropUndefined,
  hasUndefined,
} from "@dwidge/query-axios-zod";
import { Expand, randInt50 } from "@dwidge/randid";
import { traceAsync } from "@dwidge/trace-js";
import { asyncMap, topologicalSortItems } from "@dwidge/utils-js";
import * as assert from "assert";
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
import { ConflictError, NotAuthorizedError, NotFoundError } from "./Error.js";
import { GenericError } from "./GenericError.js";
import { findMissingForeignKeys } from "./getSequelizeErrorData.js";
import { SequelizeError } from "./SequelizeError.js";
import { ConvertItem } from "./types.js";
import { unixTimestamp } from "./unixTimestamp.js";

export type GetItemList<A> = (
  filter: Partial<A> | Partial<A>[],
  auth?: Auth,
  options?: DbQueryOptions & { columns?: (keyof A)[] },
) => Promise<{ rows: A[]; count: number; offset: number }>;
export type SetItemList<A> = (items: A[], auth?: Auth) => Promise<(A | null)[]>;
export type DetItemList<A> = (items: A[], auth?: Auth) => Promise<(A | null)[]>;

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
) => ({
  getList: getItemListType(
    toItem,
    toApiItemExtra ?? toApiItem,
    toDbItem,
    model,
  ) as GetItemList<A>,
  setList: setItemListType(toItem, toApiItem, toDbItem, model, randId),
  delList: delItemListType(toItem, toApiItem, toDbItem, model),
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
    !auth
      ? {}
      : { [Op.or]: [{ companyId: auth.CompanyId }, { companyId: null }] }
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
      // attributes,
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
    // rows: allowed.map((r) => ({ ...filter, ...r })),
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
) => (
  mustNotAddKeysNotInInput(toItem),
  mustNotAddKeysNotInInput(toApiItem),
  mustNotAddKeysNotInInput(toDbItem),
  async (items: A[], auth?: Auth) =>
    (
      await setItemList(
        toItem,
        model,
        await z.any().array().parse(items).map(toDbItem),
        auth,
        randId,
      ).catch((e) => {
        throw e instanceof GenericError ? convertErrorData(toApiItem, e) : e;
      })
    ).map((v) => (v === null ? null : dropUndefined(toApiItem(v))))
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
) => (
  mustNotAddKeysNotInInput(toItem),
  mustNotAddKeysNotInInput(toApiItem),
  mustNotAddKeysNotInInput(toDbItem),
  async (items: A[], auth?: Auth) =>
    (
      await setItemList(
        toItem,
        model,
        await z
          .any()
          .array()
          .parse(items)
          .map(toDbItem)
          .map((v) => ({ ...v, deletedAt: unixTimestamp() })),
        auth,
        randId,
      ).catch((e) => {
        throw e instanceof GenericError ? convertErrorData(toApiItem, e) : e;
      })
    ).map((v) => (v === null ? null : dropUndefined(toApiItem(v))))
);

export const setItemList = async <A extends ApiItem, D extends ApiItemDb>(
  toItem: ConvertItem<D>,
  model: ModelStatic<Model<D>>,
  items: D[],
  auth?: Auth,
  randId?: () => number,
): Promise<(D | null)[]> =>
  asyncMap(topologicalSortItems(items), (item) =>
    setItem(toItem, model, item, auth, randId),
  );

// Todo: setItems in one transaction

export async function setItem<D extends ApiItemDb>(
  toItem: ConvertItem<D>,
  model: ModelStatic<Model<D>>,
  item: D,
  auth?: Auth,
  randId = () => randInt50(),
): Promise<D | null> {
  auth = Auth.optional().parse(auth);

  if (item.id != null) {
    const one = (
      await model
        .findOne({
          where: dropUndefined({ id: item.id }) as WhereOptions<D>,
        })
        .catch(catchSequelize("setItemE1"))
    )?.toJSON();

    if (one && !canUserWriteItem(one, auth))
      throw new NotAuthorizedError("setItemE2", {
        data: {
          item: { companyId: one.companyId },
          auth: { companyId: auth?.CompanyId },
        },
      });
  }

  const write = dropUndefined(
    toItem({
      id: randId(),
      companyId: auth?.CompanyId,
      updatedAt: unixTimestamp(),
      ...dropUndefined(item),
      authorId: auth?.id,
    }),
  );

  if (!canUserWriteItem(write, auth))
    throw new NotAuthorizedError("setItemE3", {
      data: {
        item: { companyId: write.companyId },
        auth: { companyId: auth?.CompanyId },
      },
    });

  const existing = (
    await model.findAll({ where: { id: write.id } as WhereOptions<D> })
  )
    .map((v) => v.toJSON())
    .map(toItem)[0];

  try {
    const result = existing
      ? (await model
          .update(write as any, {
            where: { id: existing.id } as WhereOptions<D>,
          })
          .catch(catchSequelize2("setItemE4", model, write)),
        existing)
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
    assert.equal(key.id, write.id, "setItemE7");

    // const check = await getItemList(
    //   toItem,
    //   model,
    //   [{ id: key.id, deletedAt: undefined }] as any[],
    //   auth
    // );
    // assert.equal(check.rows.length, 1, "setItemE8");
    // return check.rows[0];

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
      // console.log("catchSequelize2E1", error, value);
      throw new ConflictError(code, { value });
    } else if (error instanceof ForeignKeyConstraintError) {
      const missing = await findMissingForeignKeys(model, value);
      throw new NotFoundError(code, { cause: { missing, value } });
    } else throw new SequelizeError(code, error, { value });
  };

const canUserReadItem = <D extends ApiItemDb>(item: D, auth?: Auth): boolean =>
  !auth || item.companyId === null || item.companyId === auth.CompanyId;

const canUserWriteItem = <D extends ApiItemDb>(item: D, auth?: Auth): boolean =>
  !auth || (item.companyId !== null && item.companyId === auth.CompanyId);
