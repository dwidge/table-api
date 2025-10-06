export type ConvertItem<R, A = R | Partial<R>> = (v: A) => R;
export type AssertItem<T> = ConvertItem<T, T>;
export type ParseItem<T> = ConvertItem<T, any>;

export type ApiRecord = Record<
  string,
  string | number | boolean | null | undefined
>;

export type ApiFilter<T> = {
  [P in keyof T]?: T[P] | T[P][];
};

export type ApiFilterValue<T> =
  | T[keyof T]
  | { $range: [T[keyof T] | undefined, T[keyof T] | undefined] }
  | { $not: T[keyof T] };
export type ApiFilterObject<T> = {
  [P in keyof T]?: ApiFilterValue<T> | ApiFilterValue<T>[];
};
export type ApiDefaultObject<T> = {
  [P in keyof T]?: T[P];
};

export interface QueryOptions<T> {
  offset?: number;
  limit?: number;
  order?: [column: keyof T, direction: "ASC" | "DESC"][];
  history?: number;
  from?: number;
}
