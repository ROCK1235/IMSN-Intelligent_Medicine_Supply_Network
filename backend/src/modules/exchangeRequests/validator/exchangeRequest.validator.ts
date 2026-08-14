import { z } from "zod";
import { EXCHANGE_REQUEST_STATUSES } from "../model/exchangeRequest.model";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectId = (label: string) => z.string().regex(objectIdRegex, `Invalid ${label} id`);

export const createExchangeRequestItemSchema = z.object({
  medicineId: objectId("medicine"),
  inventoryId: objectId("inventory"),
  quantityRequested: z.coerce.number().int().positive("Requested quantity must be at least 1"),
});

export const createExchangeRequestSchema = z.object({
  initiatorBranch: objectId("initiator branch"),
  recipientHospital: objectId("recipient hospital"),
  recipientBranch: objectId("recipient branch"),
  requiredByDate: z.coerce.date().refine((d) => d > new Date(), {
    message: "Required-by date must be in the future",
  }),
  notes: z.string().trim().max(1000).optional(),
  internalNotes: z.string().trim().max(1000).optional(),
  items: z.array(createExchangeRequestItemSchema).min(1, "At least one item is required"),
});

export type CreateExchangeRequestInput = z.infer<typeof createExchangeRequestSchema>;

export const reviewExchangeItemSchema = z.object({
  itemId: objectId("item"),
  quantityApproved: z.coerce.number().int().min(0, "Approved quantity cannot be negative"),
  reason: z.string().trim().min(5).max(500).optional(),
});

export const approveExchangeRequestSchema = z
  .object({
    items: z.array(reviewExchangeItemSchema).optional(),
  })
  .refine(
    (v) =>
      !v.items ||
      v.items.every((item) => item.quantityApproved > 0 || !!item.reason),
    {
      message: "A reason is required when rejecting an item (quantityApproved: 0)",
      path: ["items"],
    }
  );

export type ApproveExchangeRequestInput = z.infer<typeof approveExchangeRequestSchema>;

export const rejectExchangeRequestSchema = z.object({
  reason: z.string().trim().min(5, "A reason is required").max(500),
});

export type RejectExchangeRequestInput = z.infer<typeof rejectExchangeRequestSchema>;

export const cancelExchangeRequestSchema = z.object({
  reason: z.string().trim().min(5, "A reason is required").max(500),
});

export type CancelExchangeRequestInput = z.infer<typeof cancelExchangeRequestSchema>;

export const receiveExchangeItemSchema = z.object({
  itemId: objectId("item"),
  quantityReceived: z.coerce.number().int().min(0, "Received quantity cannot be negative"),
});

export const receiveExchangeRequestSchema = z.object({
  items: z.array(receiveExchangeItemSchema).optional(),
});

export type ReceiveExchangeRequestInput = z.infer<typeof receiveExchangeRequestSchema>;

export const listExchangeRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  direction: z.enum(["sent", "received"]).optional(),
  status: z.enum(EXCHANGE_REQUEST_STATUSES).optional(),
  // Admins have no home hospital, so they must specify whose exchange
  // requests to view; other roles default to their own hospital (see
  // exchangeRequest.controller.ts#list).
  hospitalId: objectId("hospital").optional(),
});

export type ListExchangeRequestsQuery = z.infer<typeof listExchangeRequestsQuerySchema>;
