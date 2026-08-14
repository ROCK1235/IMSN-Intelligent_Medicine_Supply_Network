import { Request, Response } from "express";
import * as auditLogService from "../service/auditLog.service";
import { HTTP_STATUS } from "../../../constants/http";
import { getParam } from "../../../utils/params";
import { ListAuditLogsQuery } from "../validator/auditLog.validator";

export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit, resource, action, actor, from, to, hospitalId } =
    req.validatedQuery as ListAuditLogsQuery;

  const { items, total } = await auditLogService.listAuditLogs(
    req.user!,
    { hospital: hospitalId, resource, action, actor, from, to },
    page,
    limit
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: { logs: items, page, limit, total },
  });
}

export async function listForHospital(req: Request, res: Response): Promise<void> {
  const { page, limit, resource, action, actor, from, to } =
    req.validatedQuery as ListAuditLogsQuery;

  const { items, total } = await auditLogService.listAuditLogs(
    req.user!,
    { hospital: getParam(req, "hospitalId"), resource, action, actor, from, to },
    page,
    limit
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: { logs: items, page, limit, total },
  });
}
