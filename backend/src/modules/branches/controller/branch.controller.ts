import { Request, Response } from "express";
import * as branchService from "../service/branch.service";
import { HTTP_STATUS } from "../../../constants/http";
import { BRANCH_MESSAGES } from "../../../constants/messages";
import { getParam } from "../../../utils/params";
import { ListBranchesQuery } from "../validator/branch.validator";

export async function create(req: Request, res: Response): Promise<void> {
  const branch = await branchService.createBranch(
    req.user!,
    getParam(req, "hospitalId"),
    req.body
  );
  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: BRANCH_MESSAGES.CREATE_SUCCESS,
    data: { branch },
  });
}

export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit } = req.validatedQuery as ListBranchesQuery;
  const { items, total } = await branchService.listBranches(
    getParam(req, "hospitalId"),
    page,
    limit
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: { branches: items, page, limit, total },
  });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const branch = await branchService.getBranch(
    getParam(req, "hospitalId"),
    getParam(req, "branchId")
  );
  res.status(HTTP_STATUS.OK).json({ success: true, data: { branch } });
}

export async function update(req: Request, res: Response): Promise<void> {
  const branch = await branchService.updateBranch(
    getParam(req, "hospitalId"),
    getParam(req, "branchId"),
    req.body
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: BRANCH_MESSAGES.UPDATE_SUCCESS,
    data: { branch },
  });
}

export async function deactivate(req: Request, res: Response): Promise<void> {
  const branch = await branchService.deactivateBranch(
    getParam(req, "hospitalId"),
    getParam(req, "branchId")
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: BRANCH_MESSAGES.DEACTIVATE_SUCCESS,
    data: { branch },
  });
}
