import { Types } from "mongoose";
import { AppError } from "../../../utils/AppError";
import { HTTP_STATUS } from "../../../constants/http";
import { AUTH_MESSAGES } from "../../../constants/messages";
import { isAdminRole } from "../../../utils/authorization";
import * as auditLogRepository from "../repository/auditLog.repository";

export interface RecordInput {
  actor?: string;
  actorRole?: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "LOGIN" | "LOGOUT";
  resource: string;
  resourceId?: string;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  ipAddress?: string;
  userAgent?: string;
  status?: "success" | "failure";
  errorMessage?: string;
  hospital?: string;
  branch?: string;
}

/**
 * Writes an immutable audit log row. Like notification.service.ts#notify,
 * this is deliberately best-effort: a broken audit write must never block
 * the real operation it's describing, so failures are logged and swallowed
 * rather than thrown (see MEMORY.md Phase 6 entry).
 */
export async function record(input: RecordInput): Promise<void> {
  try {
    await auditLogRepository.createLog({
      actor: input.actor ? new Types.ObjectId(input.actor) : undefined,
      actorRole: input.actorRole,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ? new Types.ObjectId(input.resourceId) : undefined,
      changes: input.changes,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      status: input.status ?? "success",
      errorMessage: input.errorMessage,
      hospital: input.hospital ? new Types.ObjectId(input.hospital) : undefined,
      branch: input.branch ? new Types.ObjectId(input.branch) : undefined,
    });
  } catch (error) {
    console.error("auditLogService.record() failed, continuing without blocking caller:", error);
  }
}

export interface Actor {
  id: string;
  role: string;
  hospital?: string;
}

/**
 * Admins may browse any hospital's log (or none, for a global view).
 * Everyone else must scope to their own hospital.
 */
export async function listAuditLogs(
  actor: Actor,
  filter: auditLogRepository.ListFilter,
  page: number,
  limit: number
) {
  if (!isAdminRole(actor.role)) {
    if (!filter.hospital || filter.hospital !== actor.hospital) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, AUTH_MESSAGES.HOSPITAL_MISMATCH);
    }
  }
  return auditLogRepository.list(filter, page, limit);
}
