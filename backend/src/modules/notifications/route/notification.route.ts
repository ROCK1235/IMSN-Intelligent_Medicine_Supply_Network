import { Router } from "express";
import * as notificationController from "../controller/notification.controller";
import { validateQuery } from "../../../middlewares/validate";
import { protect } from "../../../middlewares/authMiddleware";
import { listNotificationsQuerySchema } from "../validator/notification.validator";

// Mounted at /api/v1/notifications (see routes/index.ts). Every route here
// operates on the caller's own notifications only — no permission check
// needed beyond being authenticated, since ownership is enforced in
// notification.service.ts (recipient must match req.user.id).
const router = Router();

router.use(protect);

router.get("/", validateQuery(listNotificationsQuerySchema), notificationController.list);
router.get("/unread-count", notificationController.unreadCount);
router.patch("/:notificationId/read", notificationController.markRead);
router.post("/read-all", notificationController.markAllRead);

export default router;
