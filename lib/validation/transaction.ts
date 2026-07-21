import { z } from "zod";

export const transactionSchema = z.object({
  matrixTypeId: z.string().min(1),
});
