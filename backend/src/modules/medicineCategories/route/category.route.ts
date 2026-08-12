import { Router } from "express";
import * as categoryController from "../controller/category.controller";
import { validate, validateQuery } from "../../../middlewares/validate";
import { protect } from "../../../middlewares/authMiddleware";
import { authorize } from "../../../middlewares/authorize";
import { PERMISSIONS } from "../../../constants/permissions";
import {
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from "../validator/category.validator";

const router = Router();

router.use(protect);

router.get("/", validateQuery(listCategoriesQuerySchema), categoryController.list);
router.get("/:categoryId", categoryController.getById);

router.post(
  "/",
  authorize(PERMISSIONS.MANAGE_MEDICINE_CATALOG),
  validate(createCategorySchema),
  categoryController.create
);
router.patch(
  "/:categoryId",
  authorize(PERMISSIONS.MANAGE_MEDICINE_CATALOG),
  validate(updateCategorySchema),
  categoryController.update
);
router.post(
  "/:categoryId/deactivate",
  authorize(PERMISSIONS.MANAGE_MEDICINE_CATALOG),
  categoryController.deactivate
);

export default router;
