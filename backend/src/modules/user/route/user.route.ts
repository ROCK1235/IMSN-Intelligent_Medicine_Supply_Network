import { Router } from "express";
import * as userController from "../controller/user.controller";
import { validate } from "../../../middlewares/validate";
import { protect } from "../../../middlewares/authMiddleware";
import { loginSchema, registerSchema } from "../validator/user.validator";

const router = Router();

router.post("/register", validate(registerSchema), userController.register);
router.post("/login", validate(loginSchema), userController.login);
router.post("/refresh-token", userController.refreshToken);
router.post("/logout", userController.logout);
router.get("/me", protect, userController.me);

export default router;
