import { Request, Response } from "express";
import * as hospitalService from "../service/hospital.service";
import { HTTP_STATUS } from "../../../constants/http";
import { HOSPITAL_MESSAGES } from "../../../constants/messages";
import { getParam } from "../../../utils/params";
import { ListHospitalsQuery } from "../validator/hospital.validator";

export async function register(req: Request, res: Response): Promise<void> {
  const hospital = await hospitalService.registerHospital(req.body);
  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: HOSPITAL_MESSAGES.REGISTER_SUCCESS,
    data: { hospital },
  });
}

export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit, verified } = req.validatedQuery as ListHospitalsQuery;

  const { items, total } = await hospitalService.listHospitals(
    req.user!,
    verified === undefined ? undefined : verified === "true",
    page,
    limit
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: { hospitals: items, page, limit, total },
  });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const hospital = await hospitalService.getHospitalById(getParam(req, "hospitalId"));
  res.status(HTTP_STATUS.OK).json({ success: true, data: { hospital } });
}

export async function update(req: Request, res: Response): Promise<void> {
  const hospital = await hospitalService.updateHospital(
    req.user!,
    getParam(req, "hospitalId"),
    req.body
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: HOSPITAL_MESSAGES.UPDATE_SUCCESS,
    data: { hospital },
  });
}

export async function verify(req: Request, res: Response): Promise<void> {
  const hospital = await hospitalService.verifyHospital(getParam(req, "hospitalId"));
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: HOSPITAL_MESSAGES.VERIFY_SUCCESS,
    data: { hospital },
  });
}

export async function deactivate(req: Request, res: Response): Promise<void> {
  const hospital = await hospitalService.deactivateHospital(getParam(req, "hospitalId"));
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: HOSPITAL_MESSAGES.DEACTIVATE_SUCCESS,
    data: { hospital },
  });
}
