import { Types } from "mongoose";
import {
  ExchangeRequest,
  IExchangeRequest,
  ExchangeRequestStatus,
} from "../model/exchangeRequest.model";

export interface CreateExchangeRequestData {
  initiatorHospital: Types.ObjectId;
  initiatorBranch: Types.ObjectId;
  recipientHospital: Types.ObjectId;
  recipientBranch: Types.ObjectId;
  createdBy: Types.ObjectId;
  requiredByDate: Date;
  totalItems: number;
  totalQuantity: number;
  notes?: string;
  internalNotes?: string;
  statusHistory: { status: ExchangeRequestStatus; changedBy: Types.ObjectId }[];
}

export function createRequest(data: CreateExchangeRequestData) {
  return ExchangeRequest.create(data);
}

export function findById(id: string | Types.ObjectId) {
  return ExchangeRequest.findById(id);
}

export function saveRequest(request: IExchangeRequest) {
  return request.save();
}

export interface ListFilter {
  hospitalId: string;
  direction?: "sent" | "received";
  status?: ExchangeRequestStatus;
}

export async function list(
  filter: ListFilter,
  page: number,
  limit: number
): Promise<{ items: IExchangeRequest[]; total: number }> {
  const hospitalClause =
    filter.direction === "sent"
      ? { initiatorHospital: filter.hospitalId }
      : filter.direction === "received"
        ? { recipientHospital: filter.hospitalId }
        : {
            $or: [
              { initiatorHospital: filter.hospitalId },
              { recipientHospital: filter.hospitalId },
            ],
          };

  const query: Record<string, unknown> = { ...hospitalClause };
  if (filter.status) query.status = filter.status;

  const [items, total] = await Promise.all([
    ExchangeRequest.find(query)
      .sort({ requestDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("initiatorHospital", "name")
      .populate("recipientHospital", "name")
      .populate("initiatorBranch", "name")
      .populate("recipientBranch", "name"),
    ExchangeRequest.countDocuments(query),
  ]);
  return { items, total };
}
