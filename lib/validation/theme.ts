import { z } from "zod";

export const themeSchema = z.object({
  theme: z.enum(["LIGHT", "DARK"]),
});
