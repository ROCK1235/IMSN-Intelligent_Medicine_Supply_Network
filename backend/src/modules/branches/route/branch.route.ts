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

router.use(protect);

// Any authenticated user can view any hospital's branches — not just their
// own. Needed to pick a recipient branch when creating an exchange request
// (see Phase 7 frontend work); branch name/address/contact info isn't
// sensitive, so this follows the same "reads open, writes gated" pattern as
// the medicine catalog (DESIGN.md §2.1).
router.get("/", validateQuery(listBranchesQuerySchema), branchController.list);
router.get("/:branchId", branchController.getById);

// Only hospital managers (own hospital) / admins can mutate branches.
router.post(
  "/",
  authorize(PERMISSIONS.MANAGE_OWN_HOSPITAL),
  requireHospitalMatch("hospitalId"),
  validate(createBranchSchema),
  branchController.create
);
router.patch(
  "/:branchId",
  authorize(PERMISSIONS.MANAGE_OWN_HOSPITAL),
  requireHospitalMatch("hospitalId"),
  validate(updateBranchSchema),
  branchController.update
);
router.post(
  "/:branchId/deactivate",
  authorize(PERMISSIONS.MANAGE_OWN_HOSPITAL),
  requireHospitalMatch("hospitalId"),
  branchController.deactivate
);

export default router;
