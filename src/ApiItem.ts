import { Base32BigInt } from "@dwidge/randid";
import { z } from "zod";

export const ApiItem = z
  .object({
    // id: BigIntBase32,
    // authorId: BigIntBase32.nullable(),
    // companyId: BigIntBase32.nullable(),
    // createdAt: z.number(),
    // updatedAt: z.number().nullable(),
    // deletedAt: z.number().nullable(),
  })
  .partial();
export const ApiItemDb = z
  .object({
    id: Base32BigInt,
    authorId: Base32BigInt.nullable(),
    companyId: Base32BigInt.nullable(),
    updatedAt: z.number(),
    createdAt: z.number().nullable(),
    deletedAt: z.number().nullable(),
  })
  .partial();

export type ApiItem = Partial<{ id: string | number }>;
export type ApiItemDb = z.infer<typeof ApiItemDb>;
