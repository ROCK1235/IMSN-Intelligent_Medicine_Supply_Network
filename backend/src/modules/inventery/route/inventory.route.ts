import { Router } from "express";
import * as inventoryController from "../controller/inventory.controller";
import { validate, validateQuery } from "../../../middlewares/validate";
import { protect } from "../../../middlewares/authMiddleware";
import { authorize } from "../../../middlewares/authorize";
import { requireHospitalMatch } from "../../../middlewares/hospitalScope";
import { PERMISSIONS } from "../../../constants/permissions";
import {
  listInventoryQuerySchema,
  receiveStockSchema,
  stockAdjustmentSchema,
  updateInventorySchema,
} from "../validator/inventory.validator";

// mergeParams: true — mounted at
// /api/v1/hospitals/:hospitalId/branches/:branchId/inventory (see routes/index.ts).
const router = Router({ mergeParams: true });

router.use(protect, requireHospitalMatch("hospitalId"));

router.get("/", authorize(PERMISSIONS.VIEW_INVENTORY), validateQuery(listInventoryQuerySchema), inventoryController.list);
router.get("/:inventoryId", authorize(PERMISSIONS.VIEW_INVENTORY), inventoryController.getById);

router.post(
  "/",
  authorize(PERMISSIONS.MANAGE_INVENTORY),
  validate(receiveStockSchema),
  inventoryController.receive
);
router.post(
  "/:inventoryId/adjust",
  authorize(PERMISSIONS.MANAGE_INVENTORY),
  validate(stockAdjustmentSchema),
  inventoryController.adjust
);
router.patch(
  "/:inventoryId",
  authorize(PERMISSIONS.MANAGE_INVENTORY),
  validate(updateInventorySchema),
  inventoryController.update
);

export default router;
