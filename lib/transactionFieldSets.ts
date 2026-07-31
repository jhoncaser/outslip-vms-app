export type TransactionFieldKey =
  | "plannedDate"
  | "plannedTime"
  | "returnTime"
  | "originBusinessUnit"
  | "enrouteBusinessUnits"
  | "reason"
  | "visitorType"
  | "personToMeet"
  | "departmentId"
  | "businessUnitId"
  | "visitLocation"
  | "transportType"
  | "plateNo";

export const TRANSACTION_FIELD_SETS: Record<string, readonly TransactionFieldKey[]> = {
  Halfday: ["plannedDate", "plannedTime", "reason"],
  Undertime: ["plannedDate", "plannedTime", "reason"],
  Others: ["plannedDate", "plannedTime", "reason"],
  "Out for Lunch": ["plannedDate", "plannedTime", "returnTime", "reason"],
  "Routing to other Business Unit": [
    "plannedDate",
    "plannedTime",
    "originBusinessUnit",
    "enrouteBusinessUnits",
    "reason",
  ],
  "Visitor Pass": [
    "visitorType",
    "plannedDate",
    "plannedTime",
    "personToMeet",
    "departmentId",
    "businessUnitId",
    "visitLocation",
    "reason",
    "transportType",
    "plateNo",
  ],
};

export const TRANSACTION_FIELD_LABELS: Record<TransactionFieldKey, string> = {
  plannedDate: "Planned Date",
  plannedTime: "Planned Time",
  returnTime: "Return Time",
  originBusinessUnit: "Origin Business Unit",
  enrouteBusinessUnits: "Enroute to Other Business Unit",
  reason: "Reason",
  visitorType: "Visitor Type",
  personToMeet: "Person to Meet",
  departmentId: "Department",
  businessUnitId: "Business Unit",
  visitLocation: "Location",
  transportType: "Transport Type",
  plateNo: "Plate No.",
};

export function getActiveFields(
  matrixTypeName: string,
  values: Partial<Record<TransactionFieldKey, string | string[] | undefined>>
): readonly TransactionFieldKey[] {
  const base = TRANSACTION_FIELD_SETS[matrixTypeName] ?? [];
  if (matrixTypeName === "Visitor Pass" && values.transportType === "Walk-In") {
    return base.filter((key) => key !== "plateNo");
  }
  return base;
}

export function findMissingRequiredField(
  matrixTypeName: string,
  values: Partial<Record<TransactionFieldKey, string | string[] | undefined>>
): TransactionFieldKey | null {
  const required = getActiveFields(matrixTypeName, values);
  for (const key of required) {
    const value = values[key];
    const isEmpty = Array.isArray(value)
      ? value.length === 0
      : !value || value.trim() === "";
    if (isEmpty) return key;
  }
  return null;
}
