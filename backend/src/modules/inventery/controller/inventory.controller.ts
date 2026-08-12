import { Request, Response } from "express";
import * as inventoryService from "../service/inventory.service";
import { HTTP_STATUS } from "../../../constants/http";
import { INVENTORY_MESSAGES } from "../../../constants/messages";
import { getParam } from "../../../utils/params";
import { ExpiringQuery, ListInventoryQuery } from "../validator/inventory.validator";

export async function receive(req: Request, res: Response): Promise<void> {
  const inventory = await inventoryService.receiveStock(
    req.user!,
    getParam(req, "hospitalId"),
    getParam(req, "branchId"),
    req.body
  );
  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: INVENTORY_MESSAGES.RECEIVE_SUCCESS,
    data: { inventory },
  });
}

export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit, status, medicine } = req.validatedQuery as ListInventoryQuery;
  const { items, total } = await inventoryService.listInventory(
    req.user!,
    getParam(req, "hospitalId"),
    getParam(req, "branchId"),
    { status, medicine },
    page,
    limit
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: { inventory: items, page, limit, total },
  });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const inventory = await inventoryService.getInventory(
    req.user!,
    getParam(req, "hospitalId"),
    getParam(req, "branchId"),
    getParam(req, "inventoryId")
  );
  res.status(HTTP_STATUS.OK).json({ success: true, data: { inventory } });
}

export async function adjust(req: Request, res: Response): Promise<void> {
  const inventory = await inventoryService.adjustStock(
    req.user!,
    getParam(req, "hospitalId"),
    getParam(req, "branchId"),
    getParam(req, "inventoryId"),
    req.body
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: INVENTORY_MESSAGES.ADJUST_SUCCESS,
    data: { inventory },
  });
}

export async function update(req: Request, res: Response): Promise<void> {
  const inventory = await inventoryService.updateInventory(
    req.user!,
    getParam(req, "hospitalId"),
    getParam(req, "branchId"),
    getParam(req, "inventoryId"),
    req.body
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: INVENTORY_MESSAGES.UPDATE_SUCCESS,
    data: { inventory },
  });
}

export async function expiring(req: Request, res: Response): Promise<void> {
  const { days } = req.validatedQuery as ExpiringQuery;
  const items = await inventoryService.listExpiring(req.user!, getParam(req, "hospitalId"), days);
  res.status(HTTP_STATUS.OK).json({ success: true, data: { inventory: items, days } });
}

export async function lowStock(req: Request, res: Response): Promise<void> {
  const items = await inventoryService.listLowStock(req.user!, getParam(req, "hospitalId"));
  res.status(HTTP_STATUS.OK).json({ success: true, data: { inventory: items } });
}
