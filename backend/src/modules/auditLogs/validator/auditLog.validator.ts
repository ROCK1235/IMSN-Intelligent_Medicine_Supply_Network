import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const ACTIONS = ["CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "LOGIN", "LOGOUT"] as const;

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  resource: z.string().trim().min(1).max(50).optional(),
  action: z.enum(ACTIONS).optional(),
  actor: z.string().regex(objectIdRegex, "Invalid actor id").optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  // Only meaningful on the global /audit-logs route — admins may filter by
  // hospital there; hospital_manager callers get this filled in server-side
  // from their own hospital on the /hospitals/:hospitalId/audit-logs route.
  hospitalId: z.string().regex(objectIdRegex, "Invalid hospital id").optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
