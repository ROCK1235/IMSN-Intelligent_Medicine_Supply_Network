import { Request, Response } from "express";
import * as notificationService from "../service/notification.service";
import { HTTP_STATUS } from "../../../constants/http";
import { NOTIFICATION_MESSAGES } from "../../../constants/messages";
import { getParam } from "../../../utils/params";
import { ListNotificationsQuery } from "../validator/notification.validator";

export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit, isRead } = req.validatedQuery as ListNotificationsQuery;
  const { items, total } = await notificationService.listNotifications(
    req.user!.id,
    { isRead: isRead === undefined ? undefined : isRead === "true" },
    page,
    limit
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: { notifications: items, page, limit, total },
  });
}

export async function unreadCount(req: Request, res: Response): Promise<void> {
  const count = await notificationService.unreadCount(req.user!.id);
  res.status(HTTP_STATUS.OK).json({ success: true, data: { count } });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  await notificationService.markAsRead(req.user!.id, getParam(req, "notificationId"));
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: NOTIFICATION_MESSAGES.MARK_READ_SUCCESS,
  });
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  await notificationService.markAllAsRead(req.user!.id);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: NOTIFICATION_MESSAGES.MARK_ALL_READ_SUCCESS,
  });
}
