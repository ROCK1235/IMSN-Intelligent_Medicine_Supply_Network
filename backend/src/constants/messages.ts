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

  // Hospital-manager self-registration (see PHASES.md Phase 3)
  HOSPITAL_NOT_FOUND_FOR_REGISTRATION: "No hospital found for the given hospital id.",
  HOSPITAL_NOT_VERIFIED_FOR_REGISTRATION:
    "This hospital has not been verified yet. Please wait for admin approval.",
  HOSPITAL_ALREADY_HAS_MANAGER:
    "This hospital already has a manager account. Ask them to invite you as staff instead.",
  PROFILE_UPDATED: "Profile updated successfully.",
} as const;

export const HOSPITAL_MESSAGES = {
  DUPLICATE_EMAIL: "A hospital with this email already exists.",
  DUPLICATE_REGISTRATION_NUMBER: "A hospital with this registration number already exists.",
  DUPLICATE_LICENSE_NUMBER: "A hospital with this license number already exists.",
  DUPLICATE_TAX_ID: "A hospital with this tax ID already exists.",
  NOT_FOUND: "Hospital not found.",
  ALREADY_VERIFIED: "Hospital is already verified.",
  REGISTER_SUCCESS: "Hospital registered successfully. Awaiting admin verification.",
  VERIFY_SUCCESS: "Hospital verified successfully.",
  DEACTIVATE_SUCCESS: "Hospital deactivated successfully.",
  UPDATE_SUCCESS: "Hospital updated successfully.",
} as const;

export const BRANCH_MESSAGES = {
  NOT_FOUND: "Branch not found.",
  DUPLICATE_CODE: "This branch code is already in use.",
  HOSPITAL_INACTIVE: "Hospital not found or inactive.",
  CREATE_SUCCESS: "Branch created successfully.",
  UPDATE_SUCCESS: "Branch updated successfully.",
  DEACTIVATE_SUCCESS: "Branch deactivated successfully.",
} as const;

export const STAFF_MESSAGES = {
  NOT_FOUND: "Staff member not found.",
  BRANCH_REQUIRED_FOR_PHARMACIST: "branchId is required when inviting a pharmacist.",
  BRANCH_NOT_IN_HOSPITAL: "Branch does not belong to this hospital.",
  CANNOT_MODIFY_MANAGER: "Managers and admins cannot be managed through this endpoint.",
  INVITE_SUCCESS: "Staff member invited successfully.",
  UPDATE_SUCCESS: "Staff member updated successfully.",
} as const;
