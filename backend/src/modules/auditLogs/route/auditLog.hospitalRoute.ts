import { Router } from "express";
import * as auditLogController from "../controller/auditLog.controller";
import { validateQuery } from "../../../middlewares/validate";
import { protect } from "../../../middlewares/authMiddleware";
import { authorize } from "../../../middlewares/authorize";
import { requireHospitalMatch } from "../../../middlewares/hospitalScope";
import { PERMISSIONS } from "../../../constants/permissions";
import { listAuditLogsQuerySchema } from "../validator/auditLog.validator";

// mergeParams: true — mounted at /api/v1/hospitals/:hospitalId/audit-logs
// (see routes/index.ts). Pre-scoped to the caller's own hospital; a
// hospital_manager can browse their own hospital's trail without needing
// MANAGE_SYSTEM (admin exempt from requireHospitalMatch as usual).
const router = Router({ mergeParams: true });

router.get(
  "/",
  protect,
  authorize(PERMISSIONS.MANAGE_OWN_HOSPITAL),
  requireHospitalMatch("hospitalId"),
  validateQuery(listAuditLogsQuerySchema),
  auditLogController.listForHospital
);

export default router;
