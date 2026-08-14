import { Request, Response } from "express";
import * as exchangeRequestService from "../service/exchangeRequest.service";
import { HTTP_STATUS } from "../../../constants/http";
import { EXCHANGE_MESSAGES } from "../../../constants/messages";
import { AppError } from "../../../utils/AppError";
import { getParam } from "../../../utils/params";
import {
  ApproveExchangeRequestInput,
  CancelExchangeRequestInput,
  CreateExchangeRequestInput,
  ListExchangeRequestsQuery,
  ReceiveExchangeRequestInput,
  RejectExchangeRequestInput,
} from "../validator/exchangeRequest.validator";

export async function create(req: Request, res: Response): Promise<void> {
  const request = await exchangeRequestService.createExchangeRequest(
    req.user!,
    req.body as CreateExchangeRequestInput
  );
  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: EXCHANGE_MESSAGES.CREATE_SUCCESS,
    data: { request },
  });
}

export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit, direction, status, hospitalId } =
    req.validatedQuery as ListExchangeRequestsQuery;

  const targetHospitalId = hospitalId ?? req.user!.hospital;
  if (!targetHospitalId) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, "hospitalId is required for this role.");
  }

  const { items, total } = await exchangeRequestService.listExchangeRequests(
    req.user!,
    { hospitalId: targetHospitalId, direction, status },
    page,
    limit
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: { requests: items, page, limit, total },
  });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { request, items } = await exchangeRequestService.getExchangeRequest(
    req.user!,
    getParam(req, "requestId")
  );
  res.status(HTTP_STATUS.OK).json({ success: true, data: { request, items } });
}

export async function approve(req: Request, res: Response): Promise<void> {
  const request = await exchangeRequestService.approveExchangeRequest(
    req.user!,
    getParam(req, "requestId"),
    req.body as ApproveExchangeRequestInput
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: EXCHANGE_MESSAGES.APPROVE_SUCCESS,
    data: { request },
  });
}

export async function reject(req: Request, res: Response): Promise<void> {
  const request = await exchangeRequestService.rejectExchangeRequest(
    req.user!,
    getParam(req, "requestId"),
    req.body as RejectExchangeRequestInput
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: EXCHANGE_MESSAGES.REJECT_SUCCESS,
    data: { request },
  });
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const request = await exchangeRequestService.cancelExchangeRequest(
    req.user!,
    getParam(req, "requestId"),
    req.body as CancelExchangeRequestInput
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: EXCHANGE_MESSAGES.CANCEL_SUCCESS,
    data: { request },
  });
}

export async function ship(req: Request, res: Response): Promise<void> {
  const request = await exchangeRequestService.shipExchangeRequest(
    req.user!,
    getParam(req, "requestId")
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: EXCHANGE_MESSAGES.SHIP_SUCCESS,
    data: { request },
  });
}

export async function receive(req: Request, res: Response): Promise<void> {
  const request = await exchangeRequestService.receiveExchangeRequest(
    req.user!,
    getParam(req, "requestId"),
    req.body as ReceiveExchangeRequestInput
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: EXCHANGE_MESSAGES.RECEIVE_SUCCESS,
    data: { request },
  });
}
