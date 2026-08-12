import { Request, Response } from "express";
import * as manufacturerService from "../service/manufacturer.service";
import { HTTP_STATUS } from "../../../constants/http";
import { MANUFACTURER_MESSAGES } from "../../../constants/messages";
import { getParam } from "../../../utils/params";
import { ListManufacturersQuery } from "../validator/manufacturer.validator";

export async function create(req: Request, res: Response): Promise<void> {
  const manufacturer = await manufacturerService.createManufacturer(req.body);
  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: MANUFACTURER_MESSAGES.CREATE_SUCCESS,
    data: { manufacturer },
  });
}

export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit, active } = req.validatedQuery as ListManufacturersQuery;
  const filter = active === undefined ? {} : { isActive: active === "true" };

  const { items, total } = await manufacturerService.listManufacturers(filter, page, limit);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: { manufacturers: items, page, limit, total },
  });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const manufacturer = await manufacturerService.getManufacturerById(
    getParam(req, "manufacturerId")
  );
  res.status(HTTP_STATUS.OK).json({ success: true, data: { manufacturer } });
}

export async function update(req: Request, res: Response): Promise<void> {
  const manufacturer = await manufacturerService.updateManufacturer(
    getParam(req, "manufacturerId"),
    req.body
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MANUFACTURER_MESSAGES.UPDATE_SUCCESS,
    data: { manufacturer },
  });
}

export async function deactivate(req: Request, res: Response): Promise<void> {
  const manufacturer = await manufacturerService.deactivateManufacturer(
    getParam(req, "manufacturerId")
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MANUFACTURER_MESSAGES.DEACTIVATE_SUCCESS,
    data: { manufacturer },
  });
}
