import { z } from "zod";

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const PHONE_REGEX = /^[\d\s\-\+\(\)]{10,15}$/;
const BRANCH_TYPES = ["main", "satellite", "dispensary", "clinic", "pharmacy"] as const;

const dayHoursSchema = z.object({
  open: z.string().regex(TIME_REGEX, "Invalid time format (HH:MM)"),
  close: z.string().regex(TIME_REGEX, "Invalid time format (HH:MM)"),
});

const operatingHoursSchema = z.object({
  monday: dayHoursSchema,
  tuesday: dayHoursSchema,
  wednesday: dayHoursSchema,
  thursday: dayHoursSchema,
  friday: dayHoursSchema,
  saturday: dayHoursSchema,
  sunday: dayHoursSchema,
});

const addressSchema = z.object({
  street: z.string().trim().min(5).max(100),
  city: z.string().trim().min(2).max(50),
  state: z.string().trim().min(2).max(50),
  postalCode: z.string().regex(/^[0-9]{6}$/, "Postal code must be 6 digits"),
  country: z.string().trim().min(2).max(56).optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export const createBranchSchema = z.object({
  name: z.string().trim().min(2, "Branch name must be at least 2 characters").max(100),
  code: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9\-]+$/, "Code must be letters, numbers, and hyphens"),
  branchType: z.enum(BRANCH_TYPES),
  address: addressSchema,
  contactPerson: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email("Invalid email format"),
  phoneNumber: z.string().trim().regex(PHONE_REGEX, "Invalid phone number format"),
  operatingHours: operatingHoursSchema,
  bedsCount: z.coerce.number().int().min(0).optional(),
  medicineStorageCapacity: z.coerce.number().int().min(0).optional(),
  refrigeratorCapacity: z.coerce.number().int().min(0).optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    branchType: z.enum(BRANCH_TYPES).optional(),
    address: addressSchema.partial().optional(),
    contactPerson: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().toLowerCase().email("Invalid email format").optional(),
    phoneNumber: z.string().trim().regex(PHONE_REGEX, "Invalid phone number format").optional(),
    operatingHours: operatingHoursSchema.partial().optional(),
    bedsCount: z.coerce.number().int().min(0).optional(),
    medicineStorageCapacity: z.coerce.number().int().min(0).optional(),
    refrigeratorCapacity: z.coerce.number().int().min(0).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

export const listBranchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;
