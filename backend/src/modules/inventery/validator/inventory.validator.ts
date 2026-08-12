import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const STATUSES = ["active", "expiring_soon", "expired", "obsolete"] as const;

export const receiveStockSchema = z.object({
  medicineId: z.string().regex(objectIdRegex, "Invalid medicine id"),
  quantityInStock: z.coerce.number().min(0, "Quantity cannot be negative"),
  batchNumber: z
    .string()
    .trim()
    .min(5, "Batch number must be at least 5 characters")
    .max(50)
    .regex(/^[A-Za-z0-9\-]+$/, "Batch number must be letters, numbers, and hyphens"),
  manufacturingDate: z.coerce.date().max(new Date(), "Manufacturing date must be in the past"),
  expiryDate: z.coerce.date(),
  storageLocation: z.string().trim().max(50).optional(),
}).refine((v) => v.expiryDate > v.manufacturingDate, {
  message: "Expiry date must be after manufacturing date",
  path: ["expiryDate"],
});

export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;

export const stockAdjustmentSchema = z
  .object({
    type: z.enum(["stock_in", "stock_out", "adjustment"]),
    quantity: z.coerce.number().positive("Quantity must be greater than 0"),
    reason: z.string().trim().min(5).max(500).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.type === "stock_in" || !!v.reason, {
    message: "A reason is required for stock-out and adjustment transactions",
    path: ["reason"],
  });

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const updateInventorySchema = z
  .object({
    storageLocation: z.string().trim().max(50).optional(),
    lastStockCheckDate: z.coerce.date().optional(),
    lastStockCheckQuantity: z.coerce.number().min(0).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;

export const listInventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(STATUSES).optional(),
  medicine: z.string().regex(objectIdRegex).optional(),
});

export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;

export const expiringQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type ExpiringQuery = z.infer<typeof expiringQuerySchema>;
