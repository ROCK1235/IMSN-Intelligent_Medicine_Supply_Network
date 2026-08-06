import { z } from "zod";
import { SYSTEM_ROLES } from "../../roles/model/roles.model";

const PASSWORD_REGEX = {
  upper: /[A-Z]/,
  lower: /[a-z]/,
  digit: /\d/,
  special: /[!@#$%^&*]/,
};

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must not exceed 128 characters")
  .refine((v) => PASSWORD_REGEX.upper.test(v), "Password must contain an uppercase letter")
  .refine((v) => PASSWORD_REGEX.lower.test(v), "Password must contain a lowercase letter")
  .refine((v) => PASSWORD_REGEX.digit.test(v), "Password must contain a digit")
  .refine(
    (v) => PASSWORD_REGEX.special.test(v),
    "Password must contain a special character (!@#$%^&*)"
  );

export const registerSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters").max(50),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters").max(50),
  email: z.string().trim().toLowerCase().email("Invalid email format"),
  password: passwordSchema,
  phoneNumber: z.string().trim().min(10).max(15).optional(),
  role: z
    .enum([
      SYSTEM_ROLES.ADMIN,
      SYSTEM_ROLES.HOSPITAL_MANAGER,
      SYSTEM_ROLES.PHARMACIST,
      SYSTEM_ROLES.VIEWER,
    ])
    .optional(),
  hospitalId: z.string().regex(objectIdRegex, "Invalid hospital id").optional(),
  branchId: z.string().regex(objectIdRegex, "Invalid branch id").optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export type RefreshInput = z.infer<typeof refreshSchema>;
