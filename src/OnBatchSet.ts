import { ApiItemDb } from "./ApiItem.js";

export type OnBatchSet<D extends ApiItemDb> = (
  table: string,
  items: D[],
  results: { value?: D | null; error?: unknown }[],
) => void | Promise<void>;
