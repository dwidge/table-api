import { ApiItemDb } from "./ApiItem.js";

export type OnBatchError<D extends ApiItemDb> = (context: {
  modelName: string;
  items: D[];
  results: { value?: D | null; error?: unknown }[];
}) => void | Promise<void>;
