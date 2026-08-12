export const AUTH_MESSAGES = {
  EMAIL_ALREADY_REGISTERED: "An account with this email already exists.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_DEACTIVATED: "This account has been deactivated.",
  ACCOUNT_LOCKED:
    "Account is locked due to too many failed login attempts. Try again later.",
  ROLE_NOT_AVAILABLE:
    "The requested role is not available. Please contact an administrator.",
  REGISTER_SUCCESS: "Account created successfully.",
  LOGIN_SUCCESS: "Login successful.",
  LOGOUT_SUCCESS: "Logged out successfully.",
  REFRESH_SUCCESS: "Token refreshed successfully.",
  REFRESH_TOKEN_REQUIRED: "Refresh token is required.",
  REFRESH_TOKEN_INVALID: "Invalid or expired refresh token.",
  AUTH_REQUIRED: "Authentication required.",
  TOKEN_INVALID: "Invalid or expired token.",
  USER_NOT_FOUND_OR_INACTIVE: "User no longer exists or is inactive.",
  INSUFFICIENT_PERMISSIONS: "You do not have permission to perform this action.",
  HOSPITAL_MISMATCH: "You cannot access another hospital's data.",

  // Email verification
  EMAIL_ALREADY_VERIFIED: "This email is already verified.",
  VERIFICATION_TOKEN_INVALID: "Invalid or expired verification token.",
  VERIFICATION_EMAIL_SENT: "Verification email sent. Please check your inbox.",
  EMAIL_VERIFIED_SUCCESS: "Email verified successfully.",

  // Password reset
  PASSWORD_RESET_EMAIL_SENT:
    "If an account exists for that email, a password reset link has been sent.",
  RESET_TOKEN_INVALID: "Invalid or expired password reset token.",
  PASSWORD_RESET_SUCCESS:
    "Password reset successfully. Please log in with your new password.",
} as const;
