import { Types } from "mongoose";
import { InventoryTransaction } from "../model/Inventorytransactions.model";

export interface CreateTransactionData {
  transactionType:
    | "stock_in"
    | "stock_out"
    | "adjustment"
    | "exchange_sent"
    | "exchange_received"
    | "expired_disposal";
  referenceType?: "purchase_order" | "exchange_request" | "manual_adjustment" | "auto_disposal";
  referenceId?: Types.ObjectId;
  hospital: Types.ObjectId;
  branch?: Types.ObjectId;
  medicine: Types.ObjectId;
  inventory?: Types.ObjectId;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  reason?: string;
  notes?: string;
  performedBy: Types.ObjectId;
  cost?: number;
}

export function createTransaction(data: CreateTransactionData) {
  return InventoryTransaction.create(data);
}

export async function listByInventory(
  inventoryId: string | Types.ObjectId,
  page: number,
  limit: number
) {
  const query = { inventory: inventoryId };
  const [items, total] = await Promise.all([
    InventoryTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    InventoryTransaction.countDocuments(query),
  ]);
  return { items, total };
}
