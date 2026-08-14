import { Types } from "mongoose";
import { AuditLog, IAuditLog } from "../model/auditLog.model";

export interface CreateAuditLogData {
  actor?: Types.ObjectId;
  actorRole?: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "LOGIN" | "LOGOUT";
  resource: string;
  resourceId?: Types.ObjectId;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  ipAddress?: string;
  userAgent?: string;
  status?: "success" | "failure";
  errorMessage?: string;
  hospital?: Types.ObjectId;
  branch?: Types.ObjectId;
}

export function createLog(data: CreateAuditLogData) {
  return AuditLog.create(data);
}

export interface ListFilter {
  hospital?: string;
  resource?: string;
  action?: string;
  actor?: string;
  from?: Date;
  to?: Date;
}

export async function list(
  filter: ListFilter,
  page: number,
  limit: number
): Promise<{ items: IAuditLog[]; total: number }> {
  const query: Record<string, unknown> = {};
  if (filter.hospital) query.hospital = filter.hospital;
  if (filter.resource) query.resource = filter.resource;
  if (filter.action) query.action = filter.action;
  if (filter.actor) query.actor = filter.actor;
  if (filter.from || filter.to) {
    query.createdAt = {
      ...(filter.from ? { $gte: filter.from } : {}),
      ...(filter.to ? { $lte: filter.to } : {}),
    };
  }

  const [items, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("actor", "firstName lastName email"),
    AuditLog.countDocuments(query),
  ]);
  return { items, total };
}
