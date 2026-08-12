import { Router } from "express";
import * as manufacturerController from "../controller/manufacturer.controller";
import { validate, validateQuery } from "../../../middlewares/validate";
import { protect } from "../../../middlewares/authMiddleware";
import { authorize } from "../../../middlewares/authorize";
import { PERMISSIONS } from "../../../constants/permissions";
import {
  createManufacturerSchema,
  listManufacturersQuerySchema,
  updateManufacturerSchema,
} from "../validator/manufacturer.validator";

const router = Router();

router.use(protect);

// Catalog reads: any authenticated user (needed to browse/search when
// creating medicines or inventory).
router.get("/", validateQuery(listManufacturersQuerySchema), manufacturerController.list);
router.get("/:manufacturerId", manufacturerController.getById);

// Catalog mutations: admin only.
router.post(
  "/",
  authorize(PERMISSIONS.MANAGE_MEDICINE_CATALOG),
  validate(createManufacturerSchema),
  manufacturerController.create
);
router.patch(
  "/:manufacturerId",
  authorize(PERMISSIONS.MANAGE_MEDICINE_CATALOG),
  validate(updateManufacturerSchema),
  manufacturerController.update
);
router.post(
  "/:manufacturerId/deactivate",
  authorize(PERMISSIONS.MANAGE_MEDICINE_CATALOG),
  manufacturerController.deactivate
);

export default router;
