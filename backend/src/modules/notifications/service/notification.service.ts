import { Types } from "mongoose";
import { AppError } from "../../../utils/AppError";
import { HTTP_STATUS } from "../../../constants/http";
import { NOTIFICATION_MESSAGES } from "../../../constants/messages";
import * as notificationRepository from "../repository/notification.repository";

export interface NotifyInput {
  recipient: string | Types.ObjectId;
  type: string;
  title: string;
  message: string;
  relatedEntity?: { entityType: string; entityId: Types.ObjectId };
}

/**
 * Creates a single in-app notification. Deliberately fire-and-forget from the
 * caller's perspective — a notification failure should never block the
 * business operation that triggered it (see MEMORY.md Phase 6 entry), so
 * every call site awaits this but does not let a rejection propagate.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await notificationRepository.createNotification({
      recipient: new Types.ObjectId(input.recipient),
      type: input.type,
      title: input.title,
      message: input.message,
      relatedEntity: input.relatedEntity,
    });
  } catch (error) {
    console.error("notify() failed, continuing without blocking caller:", error);
  }
}

/**
 * Same as notify(), but fans a single event out to multiple recipients
 * (e.g. every hospital_manager at a hospital) in one insert.
 */
export async function notifyMany(
  recipients: (string | Types.ObjectId)[],
  type: string,
  title: string,
  message: string,
  relatedEntity?: { entityType: string; entityId: Types.ObjectId }
): Promise<void> {
  if (recipients.length === 0) return;
  try {
    await notificationRepository.createMany(
      recipients.map((recipient) => ({
        recipient: new Types.ObjectId(recipient),
        type,
        title,
        message,
        relatedEntity,
      }))
    );
  } catch (error) {
    console.error("notifyMany() failed, continuing without blocking caller:", error);
  }
}

export async function listNotifications(
  userId: string,
  filter: notificationRepository.ListFilter,
  page: number,
  limit: number
) {
  return notificationRepository.listForUser(userId, filter, page, limit);
}

export async function unreadCount(userId: string): Promise<number> {
  return notificationRepository.countUnread(userId);
}

export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  const notification = await notificationRepository.findByIdForUser(notificationId, userId);
  if (!notification) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, NOTIFICATION_MESSAGES.NOT_FOUND);
  }
  if (!notification.isRead) {
    notification.isRead = true;
    await notificationRepository.saveNotification(notification);
  }
}

export async function markAllAsRead(userId: string): Promise<void> {
  await notificationRepository.markAllRead(userId);
}
