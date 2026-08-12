import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const STAFF_ROLES = ["pharmacist", "viewer"] as const;

export const inviteStaffSchema = z
  .object({
    firstName: z.string().trim().min(2, "First name must be at least 2 characters").max(50),
    lastName: z.string().trim().min(2, "Last name must be at least 2 characters").max(50),
    email: z.string().trim().toLowerCase().email("Invalid email format"),
    phoneNumber: z.string().trim().min(10).max(15).optional(),
    role: z.enum(STAFF_ROLES),
    branchId: z.string().regex(objectIdRegex, "Invalid branch id").optional(),
  })
  .refine((v) => v.role !== "pharmacist" || !!v.branchId, {
    message: "branchId is required when inviting a pharmacist",
    path: ["branchId"],
  });

export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;

export const updateStaffSchema = z
  .object({
    role: z.enum(STAFF_ROLES).optional(),
    branchId: z.string().regex(objectIdRegex, "Invalid branch id").optional(),
    isActive: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const listStaffQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListStaffQuery = z.infer<typeof listStaffQuerySchema>;
