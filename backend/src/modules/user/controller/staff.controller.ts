import { Request, Response } from "express";
import * as staffService from "../service/staff.service";
import { HTTP_STATUS } from "../../../constants/http";
import { STAFF_MESSAGES } from "../../../constants/messages";
import { getParam } from "../../../utils/params";
import { ListStaffQuery } from "../validator/staff.validator";

export async function invite(req: Request, res: Response): Promise<void> {
  const staff = await staffService.inviteStaff(
    req.user!,
    getParam(req, "hospitalId"),
    req.body
  );
  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: STAFF_MESSAGES.INVITE_SUCCESS,
    data: { staff },
  });
}

export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit } = req.validatedQuery as ListStaffQuery;
  const { items, total } = await staffService.listStaff(
    req.user!,
    getParam(req, "hospitalId"),
    page,
    limit
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: { staff: items, page, limit, total },
  });
}

export async function update(req: Request, res: Response): Promise<void> {
  const staff = await staffService.updateStaff(
    req.user!,
    getParam(req, "hospitalId"),
    getParam(req, "userId"),
    req.body
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: STAFF_MESSAGES.UPDATE_SUCCESS,
    data: { staff },
  });
}
