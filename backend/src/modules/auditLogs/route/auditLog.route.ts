import { Router } from "express";
import * as auditLogController from "../controller/auditLog.controller";
import { validateQuery } from "../../../middlewares/validate";
import { protect } from "../../../middlewares/authMiddleware";
import { authorize } from "../../../middlewares/authorize";
import { PERMISSIONS } from "../../../constants/permissions";
import { listAuditLogsQuerySchema } from "../validator/auditLog.validator";

// Mounted at /api/v1/audit-logs (see routes/index.ts). Admin-only global
// browse, optionally filtered to one hospital via ?hospitalId=. Hospital
// managers use the nested /hospitals/:hospitalId/audit-logs route instead
// (auditLog.hospitalRoute.ts), which is pre-scoped to their own hospital.
const router = Router();

router.get(
  "/",
  protect,
  authorize(PERMISSIONS.MANAGE_SYSTEM),
  validateQuery(listAuditLogsQuerySchema),
  auditLogController.list
);

export default router;
