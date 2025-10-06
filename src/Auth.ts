import z from "zod";

export type Auth = {
  id: number | null;
  RoleId: number;
  CompanyId: number | null;
};

export const Auth = z.object({
  id: z.number().nullable(),
  RoleId: z.number(),
  CompanyId: z.number().nullable(),
});
