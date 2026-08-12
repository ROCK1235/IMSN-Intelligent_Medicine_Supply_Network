import { z } from "zod";

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

/**
 * Public self-registration is deliberately narrow: it only ever creates the
 * first Hospital Manager account for an already-verified hospital (see
 * PRD §6.1, DESIGN.md §1.5). It can NOT be used to create an admin, a
 * pharmacist, or a viewer — those are provisioned out-of-band (admin) or via
 * the invite-only staff endpoints under /hospitals/:hospitalId/staff
 * (pharmacist/viewer), which force role + hospital server-side instead of
 * trusting client input.
 */
export const registerSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters").max(50),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters").max(50),
  email: z.string().trim().toLowerCase().email("Invalid email format"),
  password: passwordSchema,
  phoneNumber: z.string().trim().min(10).max(15).optional(),
  hospitalId: z.string().regex(objectIdRegex, "Invalid hospital id"),
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

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email format"),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email format"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updateOwnProfileSchema = z
  .object({
    firstName: z.string().trim().min(2).max(50).optional(),
    lastName: z.string().trim().min(2).max(50).optional(),
    phoneNumber: z.string().trim().min(10).max(15).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
