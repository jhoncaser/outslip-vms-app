import { z } from "zod";

export const matrixTypeSchema = z.object({
  name: z.string().min(1),
});
