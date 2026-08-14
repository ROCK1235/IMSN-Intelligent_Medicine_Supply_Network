import { Types } from "mongoose";
import { IExchangeRequest } from "../model/exchangeRequest.model";
import { IExchangeItem } from "../../exchangeItems/model/exchangeItem.model";
import { AppError } from "../../../utils/AppError";
import { HTTP_STATUS } from "../../../constants/http";
import {
  EXCHANGE_MESSAGES,
  INVENTORY_MESSAGES,
  MEDICINE_MESSAGES,
  BRANCH_MESSAGES,
  HOSPITAL_MESSAGES,
} from "../../../constants/messages";
import { isAdminRole } from "../../../utils/authorization";
import * as exchangeRequestRepository from "../repository/exchangeRequest.repository";
import * as exchangeItemRepository from "../../exchangeItems/repository/exchangeItem.repository";
import * as hospitalRepository from "../repository/hospital.repository";
import * as branchRepository from "../repository/branch.repository";
import * as inventoryRepository from "../repository/inventory.repository";
import * as medicineRepository from "../repository/medicine.repository";
import * as transactionRepository from "../../Inventorytransactions/repository/inventoryTransaction.repository";
import * as userLookupRepository from "../repository/user.repository";
import * as notificationService from "../../notifications/service/notification.service";
import * as auditLogService from "../../auditLogs/service/auditLog.service";
import {
  ApproveExchangeRequestInput,
  CancelExchangeRequestInput,
  CreateExchangeRequestInput,
  ReceiveExchangeRequestInput,
  RejectExchangeRequestInput,
} from "../validator/exchangeRequest.validator";

export interface Actor {
  id: string;
  role: string;
  hospital?: string;
}

function assertParticipant(actor: Actor, request: IExchangeRequest): void {
  if (isAdminRole(actor.role)) return;
  const initiator = request.initiatorHospital.toString();
  const recipient = request.recipientHospital.toString();
  if (actor.hospital !== initiator && actor.hospital !== recipient) {
    throw new AppError(HTTP_STATUS.FORBIDDEN, EXCHANGE_MESSAGES.NOT_PARTICIPANT);
  }
}

function assertInitiator(actor: Actor, request: IExchangeRequest, message: string): void {
  if (isAdminRole(actor.role)) return;
  if (actor.hospital !== request.initiatorHospital.toString()) {
    throw new AppError(HTTP_STATUS.FORBIDDEN, message);
  }
}

function assertRecipient(actor: Actor, request: IExchangeRequest, message: string): void {
  if (isAdminRole(actor.role)) return;
  if (actor.hospital !== request.recipientHospital.toString()) {
    throw new AppError(HTTP_STATUS.FORBIDDEN, message);
  }
}

async function getRequestOrThrow(requestId: string): Promise<IExchangeRequest> {
  const request = await exchangeRequestRepository.findById(requestId);
  if (!request) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, EXCHANGE_MESSAGES.NOT_FOUND);
  }
  return request;
}

function relatedEntity(request: IExchangeRequest) {
  return { entityType: "exchange_request", entityId: request._id };
}

async function releaseReservation(inventoryId: Types.ObjectId, quantity: number): Promise<void> {
  if (quantity <= 0) return;
  const inventory = await inventoryRepository.findById(inventoryId);
  if (!inventory) return;
  inventory.quantityReserved = Math.max(0, inventory.quantityReserved - quantity);
  inventory.quantityAvailable = Math.max(0, inventory.quantityInStock - inventory.quantityReserved);
  await inventoryRepository.saveInventory(inventory);
}

export async function createExchangeRequest(
  actor: Actor,
  input: CreateExchangeRequestInput
): Promise<IExchangeRequest> {
  if (!actor.hospital) {
    throw new AppError(HTTP_STATUS.FORBIDDEN, EXCHANGE_MESSAGES.NOT_PARTICIPANT);
  }
  const initiatorHospitalId = actor.hospital;

  if (initiatorHospitalId === input.recipientHospital) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, EXCHANGE_MESSAGES.SAME_HOSPITAL);
  }

  const recipientHospital = await hospitalRepository.findById(input.recipientHospital);
  if (!recipientHospital || !recipientHospital.isActive) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, HOSPITAL_MESSAGES.NOT_FOUND);
  }

  const initiatorBranch = await branchRepository.findById(input.initiatorBranch);
  if (
    !initiatorBranch ||
    !initiatorBranch.isActive ||
    initiatorBranch.hospital.toString() !== initiatorHospitalId
  ) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, BRANCH_MESSAGES.NOT_FOUND);
  }

  const recipientBranch = await branchRepository.findById(input.recipientBranch);
  if (
    !recipientBranch ||
    !recipientBranch.isActive ||
    recipientBranch.hospital.toString() !== input.recipientHospital
  ) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, EXCHANGE_MESSAGES.BRANCH_NOT_IN_HOSPITAL);
  }

  const validatedItems = [];
  for (const item of input.items) {
    const medicine = await medicineRepository.findById(item.medicineId);
    if (!medicine || !medicine.isActive) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, MEDICINE_MESSAGES.NOT_FOUND);
    }

    const inventory = await inventoryRepository.findById(item.inventoryId);
    if (!inventory) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, INVENTORY_MESSAGES.NOT_FOUND);
    }
    if (
      inventory.branch.toString() !== input.initiatorBranch ||
      inventory.hospital.toString() !== initiatorHospitalId
    ) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, EXCHANGE_MESSAGES.INVENTORY_NOT_IN_INITIATOR_BRANCH);
    }
    if (inventory.medicine.toString() !== item.medicineId) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, EXCHANGE_MESSAGES.MEDICINE_MISMATCH);
    }
    if (!inventory.canBeUsedForExchange()) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, EXCHANGE_MESSAGES.NOT_EXCHANGEABLE);
    }
    if (item.quantityRequested > inventory.quantityAvailable) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, EXCHANGE_MESSAGES.INSUFFICIENT_AVAILABLE);
    }

    validatedItems.push({ item, inventory });
  }

  // Reserve stock only after every item has passed validation, so a bad item
  // partway through the array never leaves a partial reservation behind.
  for (const { item, inventory } of validatedItems) {
    inventory.quantityReserved += item.quantityRequested;
    inventory.quantityAvailable = Math.max(0, inventory.quantityInStock - inventory.quantityReserved);
    await inventoryRepository.saveInventory(inventory);
  }

  const performedBy = new Types.ObjectId(actor.id);
  const totalQuantity = input.items.reduce((sum, i) => sum + i.quantityRequested, 0);

  const request = await exchangeRequestRepository.createRequest({
    initiatorHospital: new Types.ObjectId(initiatorHospitalId),
    initiatorBranch: new Types.ObjectId(input.initiatorBranch),
    recipientHospital: new Types.ObjectId(input.recipientHospital),
    recipientBranch: new Types.ObjectId(input.recipientBranch),
    createdBy: performedBy,
    requiredByDate: input.requiredByDate,
    totalItems: input.items.length,
    totalQuantity,
    notes: input.notes,
    internalNotes: input.internalNotes,
    statusHistory: [{ status: "pending", changedBy: performedBy }],
  });

  for (const { item, inventory } of validatedItems) {
    await exchangeItemRepository.createItem({
      exchangeRequest: request._id,
      medicine: new Types.ObjectId(item.medicineId),
      inventory: inventory._id,
      quantityRequested: item.quantityRequested,
      expiryDate: inventory.expiryDate,
      batchNumber: inventory.batchNumber,
    });
  }

  const recipientManagers = await userLookupRepository.findHospitalManagers(input.recipientHospital);
  await notificationService.notifyMany(
    recipientManagers.map((m) => m._id),
    "exchange_request_created",
    "New exchange request",
    `${request.requestNumber} is awaiting your review.`,
    relatedEntity(request)
  );

  await auditLogService.record({
    actor: actor.id,
    actorRole: actor.role,
    action: "CREATE",
    resource: "exchange_request",
    resourceId: request._id.toString(),
    hospital: initiatorHospitalId,
  });

  return request;
}

export async function getExchangeRequest(
  actor: Actor,
  requestId: string
): Promise<{ request: IExchangeRequest; items: IExchangeItem[] }> {
  const request = await getRequestOrThrow(requestId);
  assertParticipant(actor, request);
  const items = await exchangeItemRepository.findByRequest(request._id);
  return { request, items };
}

export async function listExchangeRequests(
  actor: Actor,
  filter: exchangeRequestRepository.ListFilter,
  page: number,
  limit: number
) {
  if (!isAdminRole(actor.role) && actor.hospital !== filter.hospitalId) {
    throw new AppError(HTTP_STATUS.FORBIDDEN, EXCHANGE_MESSAGES.NOT_PARTICIPANT);
  }
  return exchangeRequestRepository.list(filter, page, limit);
}

export async function approveExchangeRequest(
  actor: Actor,
  requestId: string,
  input: ApproveExchangeRequestInput
): Promise<IExchangeRequest> {
  const request = await getRequestOrThrow(requestId);
  assertRecipient(actor, request, EXCHANGE_MESSAGES.ONLY_RECIPIENT_CAN_APPROVE);
  if (request.status !== "pending") {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, EXCHANGE_MESSAGES.INVALID_STATUS_FOR_APPROVE);
  }

  const items = await exchangeItemRepository.findByRequest(request._id);
  let anyApproved = false;

  for (const item of items) {
    const override = input.items?.find((i) => i.itemId === item._id.toString());
    const quantityApproved = override ? override.quantityApproved : item.quantityRequested;

    if (quantityApproved > item.quantityRequested) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, EXCHANGE_MESSAGES.QUANTITY_APPROVED_EXCEEDS_REQUESTED);
    }

    const releaseAmount = item.quantityRequested - quantityApproved;
    await releaseReservation(item.inventory, releaseAmount);

    item.quantityApproved = quantityApproved;
    if (quantityApproved === 0) {
      item.status = "rejected";
      item.reason = override?.reason;
    } else {
      item.status = "approved";
      anyApproved = true;
    }
    await exchangeItemRepository.saveItem(item);
  }

  const performedBy = new Types.ObjectId(actor.id);
  if (!anyApproved) {
    request.status = "rejected";
    request.rejectionReason = EXCHANGE_MESSAGES.ALL_ITEMS_REJECTED;
    request.rejectionDate = new Date();
  } else {
    request.status = "approved";
    request.approvalDate = new Date();
  }
  request.approvedBy = performedBy;
  request.statusHistory.push({ status: request.status, changedAt: new Date(), changedBy: performedBy });
  await exchangeRequestRepository.saveRequest(request);

  await notificationService.notify({
    recipient: request.createdBy,
    type: anyApproved ? "exchange_request_approved" : "exchange_request_rejected",
    title: anyApproved ? "Exchange request approved" : "Exchange request rejected",
    message: anyApproved
      ? `${request.requestNumber} was approved by the recipient hospital.`
      : `${request.requestNumber} was rejected — all items were declined.`,
    relatedEntity: relatedEntity(request),
  });

  await auditLogService.record({
    actor: actor.id,
    actorRole: actor.role,
    action: anyApproved ? "APPROVE" : "REJECT",
    resource: "exchange_request",
    resourceId: request._id.toString(),
    hospital: request.recipientHospital.toString(),
  });

  return request;
}

export async function rejectExchangeRequest(
  actor: Actor,
  requestId: string,
  input: RejectExchangeRequestInput
): Promise<IExchangeRequest> {
  const request = await getRequestOrThrow(requestId);
  assertRecipient(actor, request, EXCHANGE_MESSAGES.ONLY_RECIPIENT_CAN_APPROVE);
  if (request.status !== "pending") {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, EXCHANGE_MESSAGES.INVALID_STATUS_FOR_APPROVE);
  }

  const items = await exchangeItemRepository.findByRequest(request._id);
  for (const item of items) {
    await releaseReservation(item.inventory, item.quantityRequested);
    item.status = "rejected";
    item.reason = input.reason;
    await exchangeItemRepository.saveItem(item);
  }

  const performedBy = new Types.ObjectId(actor.id);
  request.status = "rejected";
  request.rejectionReason = input.reason;
  request.rejectionDate = new Date();
  request.statusHistory.push({ status: "rejected", changedAt: new Date(), changedBy: performedBy, reason: input.reason });
  await exchangeRequestRepository.saveRequest(request);

  await notificationService.notify({
    recipient: request.createdBy,
    type: "exchange_request_rejected",
    title: "Exchange request rejected",
    message: `${request.requestNumber} was rejected: ${input.reason}`,
    relatedEntity: relatedEntity(request),
  });

  await auditLogService.record({
    actor: actor.id,
    actorRole: actor.role,
    action: "REJECT",
    resource: "exchange_request",
    resourceId: request._id.toString(),
    hospital: request.recipientHospital.toString(),
  });

  return request;
}

export async function cancelExchangeRequest(
  actor: Actor,
  requestId: string,
  input: CancelExchangeRequestInput
): Promise<IExchangeRequest> {
  const request = await getRequestOrThrow(requestId);
  assertInitiator(actor, request, EXCHANGE_MESSAGES.ONLY_INITIATOR_CAN_CANCEL);
  if (request.status !== "pending" && request.status !== "approved") {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, EXCHANGE_MESSAGES.INVALID_STATUS_FOR_CANCEL);
  }

  const items = await exchangeItemRepository.findByRequest(request._id);
  for (const item of items) {
    if (item.status === "rejected") continue;
    const releaseQty = item.quantityApproved ?? item.quantityRequested;
    await releaseReservation(item.inventory, releaseQty);
  }

  const performedBy = new Types.ObjectId(actor.id);
  request.status = "cancelled";
  request.cancelledByUser = performedBy;
  request.cancellationReason = input.reason;
  request.statusHistory.push({ status: "cancelled", changedAt: new Date(), changedBy: performedBy, reason: input.reason });
  await exchangeRequestRepository.saveRequest(request);

  const recipientManagers = await userLookupRepository.findHospitalManagers(
    request.recipientHospital
  );
  await notificationService.notifyMany(
    recipientManagers.map((m) => m._id),
    "exchange_request_cancelled",
    "Exchange request cancelled",
    `${request.requestNumber} was cancelled by the initiator: ${input.reason}`,
    relatedEntity(request)
  );

  await auditLogService.record({
    actor: actor.id,
    actorRole: actor.role,
    action: "UPDATE",
    resource: "exchange_request",
    resourceId: request._id.toString(),
    hospital: request.initiatorHospital.toString(),
  });

  return request;
}

export async function shipExchangeRequest(actor: Actor, requestId: string): Promise<IExchangeRequest> {
  const request = await getRequestOrThrow(requestId);
  assertInitiator(actor, request, EXCHANGE_MESSAGES.ONLY_INITIATOR_CAN_SHIP);
  if (request.status !== "approved") {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, EXCHANGE_MESSAGES.INVALID_STATUS_FOR_SHIP);
  }

  const items = await exchangeItemRepository.findByRequest(request._id);
  const performedBy = new Types.ObjectId(actor.id);

  for (const item of items) {
    if (item.status !== "approved") continue;

    const inventory = await inventoryRepository.findById(item.inventory);
    if (!inventory) continue;

    const medicine = await medicineRepository.findById(item.medicine.toString());
    const unitCost = medicine?.unitCost ?? 0;
    const qty = item.quantityApproved ?? item.quantityRequested;

    const quantityBefore = inventory.quantityInStock;
    inventory.quantityInStock -= qty;
    inventory.quantityReserved = Math.max(0, inventory.quantityReserved - qty);
    inventory.cost = inventory.quantityInStock * unitCost;
    await inventoryRepository.saveInventory(inventory);

    await transactionRepository.createTransaction({
      transactionType: "exchange_sent",
      referenceType: "exchange_request",
      referenceId: request._id,
      hospital: request.initiatorHospital,
      branch: request.initiatorBranch as Types.ObjectId,
      medicine: item.medicine,
      inventory: inventory._id,
      quantity: -qty,
      quantityBefore,
      quantityAfter: inventory.quantityInStock,
      reason: `Shipped via exchange ${request.requestNumber}`,
      performedBy,
      cost: qty * unitCost,
    });

    item.status = "delivered";
    await exchangeItemRepository.saveItem(item);
  }

  request.status = "in_transit";
  request.statusHistory.push({ status: "in_transit", changedAt: new Date(), changedBy: performedBy });
  await exchangeRequestRepository.saveRequest(request);

  const recipientManagers = await userLookupRepository.findHospitalManagers(
    request.recipientHospital
  );
  await notificationService.notifyMany(
    recipientManagers.map((m) => m._id),
    "exchange_request_shipped",
    "Exchange request shipped",
    `${request.requestNumber} is on its way — mark it received once it arrives.`,
    relatedEntity(request)
  );

  await auditLogService.record({
    actor: actor.id,
    actorRole: actor.role,
    action: "UPDATE",
    resource: "exchange_request",
    resourceId: request._id.toString(),
    hospital: request.initiatorHospital.toString(),
  });

  return request;
}

export async function receiveExchangeRequest(
  actor: Actor,
  requestId: string,
  input: ReceiveExchangeRequestInput
): Promise<IExchangeRequest> {
  const request = await getRequestOrThrow(requestId);
  assertRecipient(actor, request, EXCHANGE_MESSAGES.ONLY_RECIPIENT_CAN_RECEIVE);
  if (request.status !== "in_transit") {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, EXCHANGE_MESSAGES.INVALID_STATUS_FOR_RECEIVE);
  }

  const items = await exchangeItemRepository.findByRequest(request._id);
  const performedBy = new Types.ObjectId(actor.id);

  for (const item of items) {
    if (item.status !== "delivered") continue;

    const cap = item.quantityApproved ?? item.quantityRequested;
    const override = input.items?.find((i) => i.itemId === item._id.toString());
    const quantityReceived = override ? override.quantityReceived : cap;

    if (quantityReceived > cap) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, EXCHANGE_MESSAGES.QUANTITY_RECEIVED_EXCEEDS_APPROVED);
    }

    const medicine = await medicineRepository.findById(item.medicine.toString());
    const unitCost = medicine?.unitCost ?? 0;

    let inventory = await inventoryRepository.findByBatch(
      request.recipientHospital,
      request.recipientBranch,
      item.medicine.toString(),
      item.batchNumber
    );

    const quantityBefore = inventory ? inventory.quantityInStock : 0;

    if (inventory) {
      inventory.quantityInStock += quantityReceived;
      inventory.cost = inventory.quantityInStock * unitCost;
      await inventoryRepository.saveInventory(inventory);
    } else {
      const sourceInventory = await inventoryRepository.findById(item.inventory);
      inventory = await inventoryRepository.createInventory({
        hospital: request.recipientHospital as Types.ObjectId,
        branch: request.recipientBranch as Types.ObjectId,
        medicine: item.medicine,
        quantityInStock: quantityReceived,
        batchNumber: item.batchNumber,
        manufacturingDate: sourceInventory!.manufacturingDate,
        expiryDate: item.expiryDate,
        cost: quantityReceived * unitCost,
      });
    }

    await transactionRepository.createTransaction({
      transactionType: "exchange_received",
      referenceType: "exchange_request",
      referenceId: request._id,
      hospital: request.recipientHospital as Types.ObjectId,
      branch: request.recipientBranch as Types.ObjectId,
      medicine: item.medicine,
      inventory: inventory._id,
      quantity: quantityReceived,
      quantityBefore,
      quantityAfter: inventory.quantityInStock,
      performedBy,
      cost: quantityReceived * unitCost,
    });

    item.quantityReceived = quantityReceived;
    item.status = quantityReceived === cap ? "received" : "received_partial";
    await exchangeItemRepository.saveItem(item);
  }

  request.status = "completed";
  request.completionDate = new Date();
  request.statusHistory.push({ status: "completed", changedAt: new Date(), changedBy: performedBy });
  await exchangeRequestRepository.saveRequest(request);

  await notificationService.notify({
    recipient: request.createdBy,
    type: "exchange_request_completed",
    title: "Exchange request completed",
    message: `${request.requestNumber} was received by the recipient hospital.`,
    relatedEntity: relatedEntity(request),
  });

  await auditLogService.record({
    actor: actor.id,
    actorRole: actor.role,
    action: "UPDATE",
    resource: "exchange_request",
    resourceId: request._id.toString(),
    hospital: request.recipientHospital.toString(),
  });

  return request;
}
