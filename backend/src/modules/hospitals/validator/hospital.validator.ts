import { z } from "zod";

const PHONE_REGEX = /^[\d\s\-\+\(\)]{10,15}$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[0-9]{1}$/;
const ACCREDITATIONS = ["JCI", "NABH", "AABB", "CAP", "CLIA", "ISO"] as const;
const PAYMENT_TERMS = ["Net 15", "Net 30", "Net 45", "Net 60", "Prepaid"] as const;

const addressSchema = z.object({
  street: z.string().trim().min(5).max(100),
  city: z.string().trim().min(2).max(50),
  state: z.string().trim().min(2).max(50),
  postalCode: z.string().regex(/^[0-9]{6}$/, "Postal code must be 6 digits"),
  country: z.string().trim().min(2).max(56).optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export const registerHospitalSchema = z.object({
  name: z.string().trim().min(3, "Hospital name must be at least 3 characters").max(100),
  registrationNumber: z
    .string()
    .trim()
    .min(5)
    .max(50)
    .regex(/^[A-Z0-9\-]+$/, "Registration number format invalid"),
  licenseNumber: z.string().trim().min(5).max(50),
  organizationType: z.enum(["government", "private", "ngo", "research", "teaching"]),
  email: z.string().trim().toLowerCase().email("Invalid email format"),
  phoneNumber: z.string().trim().regex(PHONE_REGEX, "Invalid phone number format"),
  website: z
    .string()
    .trim()
    .regex(/^https?:\/\/.+/, "Invalid website URL")
    .optional(),
  address: addressSchema,
  bedsCount: z.coerce.number().int().min(1).max(10000),
  specializations: z.array(z.string().trim()).max(20).optional(),
  accreditations: z.array(z.enum(ACCREDITATIONS)).max(10).optional(),
  taxId: z.string().trim().regex(GSTIN_REGEX, "Invalid GSTIN format"),
  paymentTerms: z.enum(PAYMENT_TERMS).optional(),
});

export type RegisterHospitalInput = z.infer<typeof registerHospitalSchema>;

export const updateHospitalSchema = z
  .object({
    phoneNumber: z.string().trim().regex(PHONE_REGEX, "Invalid phone number format").optional(),
    website: z.string().trim().regex(/^https?:\/\/.+/, "Invalid website URL").optional(),
    address: addressSchema.partial().optional(),
    bedsCount: z.coerce.number().int().min(1).max(10000).optional(),
    specializations: z.array(z.string().trim()).max(20).optional(),
    accreditations: z.array(z.enum(ACCREDITATIONS)).max(10).optional(),
    paymentTerms: z.enum(PAYMENT_TERMS).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateHospitalInput = z.infer<typeof updateHospitalSchema>;

export const listHospitalsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  verified: z.enum(["true", "false"]).optional(),
});

export type ListHospitalsQuery = z.infer<typeof listHospitalsQuerySchema>;
