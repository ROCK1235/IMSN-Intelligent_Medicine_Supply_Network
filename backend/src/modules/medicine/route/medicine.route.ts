import { Router } from "express";
import * as medicineController from "../controller/medicine.controller";
import { validate, validateQuery } from "../../../middlewares/validate";
import { protect } from "../../../middlewares/authMiddleware";
import { authorize } from "../../../middlewares/authorize";
import { PERMISSIONS } from "../../../constants/permissions";
import {
  createMedicineSchema,
  listMedicinesQuerySchema,
  updateMedicineSchema,
} from "../validator/medicine.validator";

const router = Router();

router.use(protect);

router.get("/", validateQuery(listMedicinesQuerySchema), medicineController.list);
router.get("/:medicineId", medicineController.getById);

router.post(
  "/",
  authorize(PERMISSIONS.MANAGE_MEDICINE_CATALOG),
  validate(createMedicineSchema),
  medicineController.create
);
router.patch(
  "/:medicineId",
  authorize(PERMISSIONS.MANAGE_MEDICINE_CATALOG),
  validate(updateMedicineSchema),
  medicineController.update
);
router.post(
  "/:medicineId/discontinue",
  authorize(PERMISSIONS.MANAGE_MEDICINE_CATALOG),
  medicineController.discontinue
);

export default router;
