import { Router } from "express";
import * as hospitalController from "../controller/hospital.controller";
import { validate, validateQuery } from "../../../middlewares/validate";
import { protect } from "../../../middlewares/authMiddleware";
import { authorize } from "../../../middlewares/authorize";
import { requireHospitalMatch } from "../../../middlewares/hospitalScope";
import { PERMISSIONS } from "../../../constants/permissions";
import {
  listHospitalsQuerySchema,
  registerHospitalSchema,
  updateHospitalSchema,
} from "../validator/hospital.validator";

const router = Router();

// Public: any hospital can self-register (see PRD §6, DESIGN.md §1.4)
router.post("/register", validate(registerHospitalSchema), hospitalController.register);

// Admin only: browse/verify/deactivate hospitals
router.get(
  "/",
  protect,
  authorize(PERMISSIONS.MANAGE_HOSPITALS),
  validateQuery(listHospitalsQuerySchema),
  hospitalController.list
);

router.get("/:hospitalId", protect, hospitalController.getById);

router.patch(
  "/:hospitalId",
  protect,
  authorize(PERMISSIONS.MANAGE_OWN_HOSPITAL),
  requireHospitalMatch("hospitalId"),
  validate(updateHospitalSchema),
  hospitalController.update
);

router.post(
  "/:hospitalId/verify",
  protect,
  authorize(PERMISSIONS.MANAGE_HOSPITALS),
  hospitalController.verify
);

router.post(
  "/:hospitalId/deactivate",
  protect,
  authorize(PERMISSIONS.MANAGE_HOSPITALS),
  hospitalController.deactivate
);

export default router;
