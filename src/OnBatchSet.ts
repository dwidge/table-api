import { ApiItem } from "./ApiItem.js";

export type OnBatchSet<A extends ApiItem> = (
  table: string,
  items: A[],
  results: { value?: A | null; error?: unknown }[],
  failed: { value?: A | null; error?: unknown; item: A }[],
  passed: { value?: A | null; error?: unknown; item: A }[],
) => void | Promise<void>;
