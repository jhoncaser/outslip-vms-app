import { z } from "zod";

export const matrixTypeApproverSchema = z.object({
  matrixTypeId: z.string().min(1),
  approverId: z.string().min(1),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  departmentId: z.string().min(1),
  businessUnitId: z.string().min(1),
  locationId: z.string().min(1),
});
