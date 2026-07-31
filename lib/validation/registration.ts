import { z } from "zod";

export const registrationSchema = z
  .object({
    role: z.enum(["CREATOR", "APPROVER", "GUARD_PERSONNEL"]),
    firstName: z.string().min(1),
    middleName: z.string().optional(),
    lastName: z.string().min(1),
    jobTitle: z.string().min(1),
    departmentId: z.string().min(1),
    businessUnitId: z.string().min(1),
    locationId: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const editUserSchema = z.object({
  role: z.enum(["CREATOR", "APPROVER", "GUARD_PERSONNEL"]),
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  jobTitle: z.string().min(1),
  departmentId: z.string().min(1),
  businessUnitId: z.string().min(1),
  locationId: z.string().min(1),
  email: z.string().email(),
});
