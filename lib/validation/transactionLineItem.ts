import { z } from "zod";
import { TRANSPORT_TYPE_OPTIONS } from "@/lib/transportTypeOptions";

export const EMPLOYEE_TYPE_OPTIONS = ["Mega Employee", "Third-Party", "Visitor"] as const;

export const visitorPassLineItemSchema = z.object({
  visitorName: z.string().optional(),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  contactNumber: z.string().optional(),
  emailAddress: z.string().email().optional().or(z.literal("")),
  transportType: z.enum(TRANSPORT_TYPE_OPTIONS).optional(),
  plateNo: z.string().optional(),
});

export const employeeLineItemSchema = z.object({
  employeeType: z.enum(EMPLOYEE_TYPE_OPTIONS).optional(),
  employeeId: z.string().optional(),
  name: z.string().optional(),
  remarks: z.string().optional(),
});

export type VisitorPassLineItemFieldKey =
  | "visitorName"
  | "jobTitle"
  | "company"
  | "transportType"
  | "plateNo";

export const VISITOR_PASS_LINE_ITEM_LABELS: Record<VisitorPassLineItemFieldKey, string> = {
  visitorName: "Visitor Name",
  jobTitle: "Job Title",
  company: "Company",
  transportType: "Transport Type",
  plateNo: "Plate No.",
};

const VISITOR_PASS_REQUIRED_ORDER: VisitorPassLineItemFieldKey[] = [
  "visitorName",
  "jobTitle",
  "company",
  "transportType",
  "plateNo",
];

export function getActiveVisitorPassLineItemFields(
  values: Partial<Record<VisitorPassLineItemFieldKey, string | undefined>>
): VisitorPassLineItemFieldKey[] {
  if (values.transportType === "Walk-In") {
    return VISITOR_PASS_REQUIRED_ORDER.filter((key) => key !== "plateNo");
  }
  return VISITOR_PASS_REQUIRED_ORDER;
}

export function findMissingVisitorPassLineItemField(
  values: Partial<Record<VisitorPassLineItemFieldKey, string | undefined>>
): VisitorPassLineItemFieldKey | null {
  for (const key of getActiveVisitorPassLineItemFields(values)) {
    const value = values[key];
    if (!value || value.trim() === "") return key;
  }
  return null;
}

export type EmployeeLineItemFieldKey = "employeeType" | "employeeId" | "name" | "remarks";

export const EMPLOYEE_LINE_ITEM_LABELS: Record<EmployeeLineItemFieldKey, string> = {
  employeeType: "Employee Type",
  employeeId: "Name",
  name: "Name",
  remarks: "Remarks",
};

export function findMissingEmployeeLineItemField(values: {
  employeeType?: string;
  employeeId?: string;
  name?: string;
  remarks?: string;
}): EmployeeLineItemFieldKey | null {
  if (!values.employeeType) return "employeeType";

  if (values.employeeType === "Mega Employee") {
    if (!values.employeeId) return "employeeId";
  } else if (!values.name || values.name.trim() === "") {
    return "name";
  }

  if (!values.remarks || values.remarks.trim() === "") return "remarks";

  return null;
}
