import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const FORMS = [
  "tablet","capsule","injection","syrup","suspension","ointment","lotion",
  "cream","powder","solution","inhaler","patch","drops","spray",
] as const;
const UNITS_OF_MEASURE = ["tablet", "capsule", "ml", "gm", "unit", "vial", "ampule", "strips"] as const;
const STORAGE_TEMPERATURES = ["2-8°C", "15-25°C", "room_temperature", "below_25°C"] as const;
const STORAGE_CONDITIONS = [
  "protect_from_light","keep_dry","protect_from_moisture","away_from_heat","protect_from_air",
] as const;
const SCHEDULE_TYPES = ["H", "X", "L", "A", "C", "D", "E", "F", "G", "N"] as const;

export const createMedicineSchema = z
  .object({
    name: z.string().trim().min(2, "Medicine name must be at least 2 characters").max(100),
    genericName: z.string().trim().min(2).max(100),
    hsn_sac: z.string().trim().regex(/^[0-9]{8}[A-Z0-9]{0,2}$/, "Invalid HSN/SAC code format"),
    gst_rate: z.union([z.literal(0), z.literal(5), z.literal(12), z.literal(18), z.literal(28)]),
    category: z.string().regex(objectIdRegex, "Invalid category id"),
    manufacturer: z.string().regex(objectIdRegex, "Invalid manufacturer id"),
    strength: z
      .string()
      .trim()
      .regex(/^[\d.]+\s*(mg|mcg|g|ml|%|iu|mmol|meq)?$/, "Invalid strength format. Use: 500mg, 10ml, 5%, etc."),
    form: z.enum(FORMS),
    registrationNumber: z
      .string()
      .trim()
      .min(5)
      .max(20)
      .regex(/^[A-Z0-9\-:]+$/, "Invalid registration number format"),
    isScheduled: z.boolean().optional(),
    scheduleType: z.enum(SCHEDULE_TYPES).optional(),
    reorderLevel: z.coerce.number().min(0),
    maxStockLevel: z.coerce.number().min(0),
    unitOfMeasure: z.enum(UNITS_OF_MEASURE),
    shelfLife: z.coerce.number().int().min(1).max(3650),
    storageTemperature: z.enum(STORAGE_TEMPERATURES),
    storageConditions: z.array(z.enum(STORAGE_CONDITIONS)).max(5).optional(),
    unitCost: z.coerce.number().min(0.01),
    sellingPrice: z.coerce.number().min(0),
  })
  .refine((v) => v.maxStockLevel > v.reorderLevel, {
    message: "Max stock level must exceed reorder level",
    path: ["maxStockLevel"],
  })
  .refine((v) => !v.isScheduled || !!v.scheduleType, {
    message: "Schedule type is required for scheduled drugs",
    path: ["scheduleType"],
  });

export type CreateMedicineInput = z.infer<typeof createMedicineSchema>;

export const updateMedicineSchema = z
  .object({
    genericName: z.string().trim().min(2).max(100).optional(),
    category: z.string().regex(objectIdRegex, "Invalid category id").optional(),
    manufacturer: z.string().regex(objectIdRegex, "Invalid manufacturer id").optional(),
    strength: z
      .string()
      .trim()
      .regex(/^[\d.]+\s*(mg|mcg|g|ml|%|iu|mmol|meq)?$/, "Invalid strength format")
      .optional(),
    form: z.enum(FORMS).optional(),
    isScheduled: z.boolean().optional(),
    scheduleType: z.enum(SCHEDULE_TYPES).optional(),
    reorderLevel: z.coerce.number().min(0).optional(),
    maxStockLevel: z.coerce.number().min(0).optional(),
    unitOfMeasure: z.enum(UNITS_OF_MEASURE).optional(),
    shelfLife: z.coerce.number().int().min(1).max(3650).optional(),
    storageTemperature: z.enum(STORAGE_TEMPERATURES).optional(),
    storageConditions: z.array(z.enum(STORAGE_CONDITIONS)).max(5).optional(),
    unitCost: z.coerce.number().min(0.01).optional(),
    sellingPrice: z.coerce.number().min(0).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateMedicineInput = z.infer<typeof updateMedicineSchema>;

export const listMedicinesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.enum(["true", "false"]).optional(),
  category: z.string().regex(objectIdRegex).optional(),
  manufacturer: z.string().regex(objectIdRegex).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export type ListMedicinesQuery = z.infer<typeof listMedicinesQuerySchema>;
