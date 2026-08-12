import { Router } from "express";
import * as userController from "../controller/user.controller";
import { validate } from "../../../middlewares/validate";
import { protect } from "../../../middlewares/authMiddleware";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../validator/user.validator";

const router = Router();

router.post("/register", validate(registerSchema), userController.register);
router.post("/login", validate(loginSchema), userController.login);
router.post("/refresh-token", userController.refreshToken);
router.post("/logout", userController.logout);
router.get("/me", protect, userController.me);

router.post("/verify-email", validate(verifyEmailSchema), userController.verifyEmail);
router.post(
  "/resend-verification",
  validate(resendVerificationSchema),
  userController.resendVerification
);

router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  userController.forgotPassword
);
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  userController.resetPassword
);

export default router;
