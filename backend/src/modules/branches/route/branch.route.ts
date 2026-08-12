import { Router } from "express";
import * as branchController from "../controller/branch.controller";
import { validate, validateQuery } from "../../../middlewares/validate";
import { protect } from "../../../middlewares/authMiddleware";
import { authorize } from "../../../middlewares/authorize";
import { requireHospitalMatch } from "../../../middlewares/hospitalScope";
import { PERMISSIONS } from "../../../constants/permissions";
import {
  createBranchSchema,
  listBranchesQuerySchema,
  updateBranchSchema,
} from "../validator/branch.validator";

// mergeParams: true — this router is mounted at
// /api/v1/hospitals/:hospitalId/branches (see routes/index.ts), and needs
// access to :hospitalId from the parent mount path.
const router = Router({ mergeParams: true });

router.use(protect, requireHospitalMatch("hospitalId"));

// Any staff member of this hospital (or admin) can view its branches.
router.get("/", validateQuery(listBranchesQuerySchema), branchController.list);
router.get("/:branchId", branchController.getById);

// Only hospital managers (own hospital) / admins can mutate branches.
router.post(
  "/",
  authorize(PERMISSIONS.MANAGE_OWN_HOSPITAL),
  validate(createBranchSchema),
  branchController.create
);
router.patch(
  "/:branchId",
  authorize(PERMISSIONS.MANAGE_OWN_HOSPITAL),
  validate(updateBranchSchema),
  branchController.update
);
router.post(
  "/:branchId/deactivate",
  authorize(PERMISSIONS.MANAGE_OWN_HOSPITAL),
  branchController.deactivate
);

export default router;
