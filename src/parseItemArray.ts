import z from "zod";
import { ConvertItem } from "./types.js";

export const parseItemArray = <B, A>(
  parse: ConvertItem<B, A>,
  items: A[],
): B[] => z.any().array().parse(items).map(parse);
