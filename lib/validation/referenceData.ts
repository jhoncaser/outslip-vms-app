import { z } from "zod";

export const referenceDataSchema = z.object({
  type: z.enum(["department", "businessUnit", "location"]),
  name: z.string().min(1),
});
