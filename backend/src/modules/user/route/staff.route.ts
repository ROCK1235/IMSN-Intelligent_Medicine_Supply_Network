import { Router } from "express";
import * as staffController from "../controller/staff.controller";
import { validate, validateQuery } from "../../../middlewares/validate";
import { protect } from "../../../middlewares/authMiddleware";
import { authorize } from "../../../middlewares/authorize";
import { requireHospitalMatch } from "../../../middlewares/hospitalScope";
import { PERMISSIONS } from "../../../constants/permissions";
import {
  inviteStaffSchema,
  listStaffQuerySchema,
  updateStaffSchema,
} from "../validator/staff.validator";

// mergeParams: true — mounted at /api/v1/hospitals/:hospitalId/staff
// (see routes/index.ts).
const router = Router({ mergeParams: true });

router.use(
  protect,
  authorize(PERMISSIONS.MANAGE_USERS),
  requireHospitalMatch("hospitalId")
);

router.post("/", validate(inviteStaffSchema), staffController.invite);
router.get("/", validateQuery(listStaffQuerySchema), staffController.list);
router.patch("/:userId", validate(updateStaffSchema), staffController.update);

export default router;
