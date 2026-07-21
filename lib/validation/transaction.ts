import { z } from "zod";
import { BUSINESS_UNIT_OPTIONS } from "@/lib/businessUnitOptions";

export const transactionSchema = z.object({
  matrixTypeId: z.string().min(1),
  plannedDate: z.string().optional(),
  plannedTime: z.string().optional(),
  returnTime: z.string().optional(),
  originBusinessUnit: z.enum(BUSINESS_UNIT_OPTIONS).optional(),
  enrouteBusinessUnits: z.array(z.enum(BUSINESS_UNIT_OPTIONS)).optional(),
  reason: z.string().optional(),
});
