import { z } from "zod";
import { BUSINESS_UNIT_OPTIONS } from "@/lib/businessUnitOptions";
import { VISITOR_TYPE_OPTIONS } from "@/lib/visitorTypeOptions";
import { TRANSPORT_TYPE_OPTIONS } from "@/lib/transportTypeOptions";

export const transactionSchema = z.object({
  matrixTypeId: z.string().min(1),
  plannedDate: z.string().optional(),
  plannedTime: z.string().optional(),
  returnTime: z.string().optional(),
  originBusinessUnit: z.enum(BUSINESS_UNIT_OPTIONS).optional(),
  enrouteBusinessUnits: z.array(z.enum(BUSINESS_UNIT_OPTIONS)).optional(),
  reason: z.string().optional(),
  visitorType: z.enum(VISITOR_TYPE_OPTIONS).optional(),
  personToMeet: z.string().optional(),
  departmentId: z.string().optional(),
  visitLocation: z.string().optional(),
  transportType: z.enum(TRANSPORT_TYPE_OPTIONS).optional(),
  plateNo: z.string().optional(),
});
