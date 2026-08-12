import { z } from "zod";

const PHONE_REGEX = /^[\d\s\-\+\(\)]{10,15}$/;
const CERTIFICATIONS = ["ISO", "GMP", "ISO9001", "ISO14001", "ISO45001", "FDA", "CE"] as const;

const addressSchema = z.object({
  street: z.string().trim().min(5).max(100),
  city: z.string().trim().min(2).max(50),
  state: z.string().trim().min(2).max(50),
  postalCode: z.string().regex(/^[0-9]{6}$/, "Postal code must be 6 digits"),
  country: z.string().trim().min(2).max(56).optional(),
});

export const createManufacturerSchema = z.object({
  name: z.string().trim().min(3, "Manufacturer name must be at least 3 characters").max(100),
  licenseNumber: z.string().trim().min(5).max(50),
  registrationDate: z.coerce.date().max(new Date(), "Registration date must be in the past"),
  email: z.string().trim().toLowerCase().email("Invalid email format"),
  phoneNumber: z.string().trim().regex(PHONE_REGEX, "Invalid phone number format"),
  address: addressSchema,
  certifications: z.array(z.enum(CERTIFICATIONS)).optional(),
});

export type CreateManufacturerInput = z.infer<typeof createManufacturerSchema>;

export const updateManufacturerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Invalid email format").optional(),
    phoneNumber: z.string().trim().regex(PHONE_REGEX, "Invalid phone number format").optional(),
    address: addressSchema.partial().optional(),
    certifications: z.array(z.enum(CERTIFICATIONS)).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateManufacturerInput = z.infer<typeof updateManufacturerSchema>;

export const listManufacturersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.enum(["true", "false"]).optional(),
});

export type ListManufacturersQuery = z.infer<typeof listManufacturersQuerySchema>;
