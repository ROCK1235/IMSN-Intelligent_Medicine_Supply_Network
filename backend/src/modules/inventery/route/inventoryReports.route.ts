import { Router } from "express";
import * as inventoryController from "../controller/inventory.controller";
import { validateQuery } from "../../../middlewares/validate";
import { protect } from "../../../middlewares/authMiddleware";
import { authorize } from "../../../middlewares/authorize";
import { requireHospitalMatch } from "../../../middlewares/hospitalScope";
import { PERMISSIONS } from "../../../constants/permissions";
import { expiringQuerySchema } from "../validator/inventory.validator";

// mergeParams: true — mounted at /api/v1/hospitals/:hospitalId/inventory
// (see routes/index.ts). Hospital-wide (all branches), read-only.
const router = Router({ mergeParams: true });

router.use(protect, authorize(PERMISSIONS.VIEW_INVENTORY), requireHospitalMatch("hospitalId"));

router.get("/expiring", validateQuery(expiringQuerySchema), inventoryController.expiring);
router.get("/low-stock", inventoryController.lowStock);

export default router;
