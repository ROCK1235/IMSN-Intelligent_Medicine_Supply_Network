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
} as const;
