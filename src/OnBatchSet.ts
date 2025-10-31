import { ApiItem } from "./ApiItem.js";

export type OnBatchSet<A extends ApiItem> = (
  table: string,
  items: A[],
  results: { value?: A | null; error?: unknown }[],
) => void | Promise<void>;
