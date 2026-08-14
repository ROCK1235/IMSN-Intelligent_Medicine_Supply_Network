import { Types } from "mongoose";
import { Notification, INotification } from "../model/notification.model";

export interface CreateNotificationData {
  recipient: Types.ObjectId;
  type: string;
  title: string;
  message: string;
  relatedEntity?: { entityType: string; entityId: Types.ObjectId };
}

export function createNotification(data: CreateNotificationData) {
  return Notification.create({
    ...data,
    deliveryStatus: { in_app: { sent: true, sentAt: new Date() } },
  });
}

export function createMany(items: CreateNotificationData[]) {
  const now = new Date();
  return Notification.insertMany(
    items.map((item) => ({
      ...item,
      deliveryStatus: { in_app: { sent: true, sentAt: now } },
    }))
  );
}

export interface ListFilter {
  isRead?: boolean;
}

export async function listForUser(
  userId: string | Types.ObjectId,
  filter: ListFilter,
  page: number,
  limit: number
): Promise<{ items: INotification[]; total: number }> {
  const query: Record<string, unknown> = { recipient: userId };
  if (filter.isRead !== undefined) query.isRead = filter.isRead;

  const [items, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(query),
  ]);
  return { items, total };
}

export function countUnread(userId: string | Types.ObjectId) {
  return Notification.countDocuments({ recipient: userId, isRead: false });
}

export function findByIdForUser(id: string | Types.ObjectId, userId: string | Types.ObjectId) {
  return Notification.findOne({ _id: id, recipient: userId });
}

export function saveNotification(notification: INotification) {
  return notification.save();
}

export function markAllRead(userId: string | Types.ObjectId) {
  return Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
}
