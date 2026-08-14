import { Types } from "mongoose";
import { ExchangeItem, IExchangeItem, ExchangeItemStatus } from "../model/exchangeItem.model";

export interface CreateExchangeItemData {
  exchangeRequest: Types.ObjectId;
  medicine: Types.ObjectId;
  inventory: Types.ObjectId;
  quantityRequested: number;
  expiryDate: Date;
  batchNumber: string;
  status?: ExchangeItemStatus;
}

export function createItem(data: CreateExchangeItemData) {
  return ExchangeItem.create(data);
}

export function findByRequest(requestId: string | Types.ObjectId) {
  return ExchangeItem.find({ exchangeRequest: requestId });
}

export function findById(id: string | Types.ObjectId) {
  return ExchangeItem.findById(id);
}

export function saveItem(item: IExchangeItem) {
  return item.save();
}
