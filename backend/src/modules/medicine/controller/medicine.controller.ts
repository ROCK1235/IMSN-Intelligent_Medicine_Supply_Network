import { Request, Response } from "express";
import * as medicineService from "../service/medicine.service";
import { HTTP_STATUS } from "../../../constants/http";
import { MEDICINE_MESSAGES } from "../../../constants/messages";
import { getParam } from "../../../utils/params";
import { ListMedicinesQuery } from "../validator/medicine.validator";

export async function create(req: Request, res: Response): Promise<void> {
  const medicine = await medicineService.createMedicine(req.body);
  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: MEDICINE_MESSAGES.CREATE_SUCCESS,
    data: { medicine },
  });
}

export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit, active, category, manufacturer, search } =
    req.validatedQuery as ListMedicinesQuery;

  const { items, total } = await medicineService.listMedicines(
    {
      isActive: active === undefined ? undefined : active === "true",
      category,
      manufacturer,
      search,
    },
    page,
    limit
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: { medicines: items, page, limit, total },
  });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const medicine = await medicineService.getMedicineById(getParam(req, "medicineId"));
  res.status(HTTP_STATUS.OK).json({ success: true, data: { medicine } });
}

export async function update(req: Request, res: Response): Promise<void> {
  const medicine = await medicineService.updateMedicine(getParam(req, "medicineId"), req.body);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MEDICINE_MESSAGES.UPDATE_SUCCESS,
    data: { medicine },
  });
}

export async function discontinue(req: Request, res: Response): Promise<void> {
  const medicine = await medicineService.discontinueMedicine(getParam(req, "medicineId"));
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MEDICINE_MESSAGES.DISCONTINUE_SUCCESS,
    data: { medicine },
  });
}
