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

export const MANUFACTURER_MESSAGES = {
  NOT_FOUND: "Manufacturer not found.",
  DUPLICATE_NAME: "A manufacturer with this name already exists.",
  DUPLICATE_LICENSE_NUMBER: "A manufacturer with this license number already exists.",
  DUPLICATE_EMAIL: "A manufacturer with this email already exists.",
  CREATE_SUCCESS: "Manufacturer created successfully.",
  UPDATE_SUCCESS: "Manufacturer updated successfully.",
  DEACTIVATE_SUCCESS: "Manufacturer deactivated successfully.",
} as const;

export const CATEGORY_MESSAGES = {
  NOT_FOUND: "Medicine category not found.",
  DUPLICATE_NAME: "A category with this name already exists.",
  DUPLICATE_CODE: "This category code is already in use.",
  PARENT_NOT_FOUND: "Parent category not found or inactive.",
  CREATE_SUCCESS: "Category created successfully.",
  UPDATE_SUCCESS: "Category updated successfully.",
  DEACTIVATE_SUCCESS: "Category deactivated successfully.",
} as const;

export const MEDICINE_MESSAGES = {
  NOT_FOUND: "Medicine not found.",
  DUPLICATE_REGISTRATION_NUMBER: "A medicine with this registration number already exists.",
  CATEGORY_NOT_FOUND: "Category not found or inactive.",
  MANUFACTURER_NOT_FOUND: "Manufacturer not found or inactive.",
  CREATE_SUCCESS: "Medicine created successfully.",
  UPDATE_SUCCESS: "Medicine updated successfully.",
  DISCONTINUE_SUCCESS: "Medicine discontinued successfully.",
} as const;

export const EXCHANGE_MESSAGES = {
  NOT_FOUND: "Exchange request not found.",
  ITEM_NOT_FOUND: "Exchange item not found.",
  HOSPITAL_INACTIVE: "Hospital not found or inactive.",
  BRANCH_NOT_IN_HOSPITAL: "Branch does not belong to this hospital.",
  SAME_HOSPITAL: "Initiator and recipient hospitals must be different.",
  ITEMS_REQUIRED: "At least one item is required.",
  INVENTORY_NOT_IN_INITIATOR_BRANCH: "Inventory batch does not belong to the initiator's branch.",
  MEDICINE_MISMATCH: "Inventory batch does not match the requested medicine.",
  NOT_EXCHANGEABLE: "This batch cannot be used for exchange (expired, expiring soon, or out of stock).",
  INSUFFICIENT_AVAILABLE: "Requested quantity exceeds available stock for this batch.",
  NOT_PARTICIPANT: "You are not a participant in this exchange request.",
  ONLY_RECIPIENT_CAN_APPROVE: "Only the recipient hospital can approve or reject this request.",
  ONLY_INITIATOR_CAN_CANCEL: "Only the initiator hospital can cancel this request.",
  ONLY_INITIATOR_CAN_SHIP: "Only the initiator hospital can mark this request as shipped.",
  ONLY_RECIPIENT_CAN_RECEIVE: "Only the recipient hospital can confirm receipt of this request.",
  INVALID_STATUS_FOR_APPROVE: "Only pending requests can be approved or rejected.",
  INVALID_STATUS_FOR_CANCEL: "Only pending or approved requests can be cancelled.",
  INVALID_STATUS_FOR_SHIP: "Only approved requests can be marked as shipped.",
  INVALID_STATUS_FOR_RECEIVE: "Only in-transit requests can be marked as received.",
  ALL_ITEMS_REJECTED: "All items were rejected; the request has been rejected.",
  QUANTITY_APPROVED_EXCEEDS_REQUESTED: "Approved quantity cannot exceed requested quantity.",
  QUANTITY_RECEIVED_EXCEEDS_APPROVED: "Received quantity cannot exceed approved quantity.",
  CREATE_SUCCESS: "Exchange request created successfully.",
  APPROVE_SUCCESS: "Exchange request reviewed successfully.",
  REJECT_SUCCESS: "Exchange request rejected.",
  CANCEL_SUCCESS: "Exchange request cancelled.",
  SHIP_SUCCESS: "Exchange request marked as shipped.",
  RECEIVE_SUCCESS: "Exchange request receipt recorded.",
} as const;

export const NOTIFICATION_MESSAGES = {
  NOT_FOUND: "Notification not found.",
  MARK_READ_SUCCESS: "Notification marked as read.",
  MARK_ALL_READ_SUCCESS: "All notifications marked as read.",
} as const;

export const INVENTORY_MESSAGES = {
  NOT_FOUND: "Inventory batch not found.",
  DUPLICATE_BATCH: "This batch number already has an inventory record for this medicine at this branch.",
  MEDICINE_NOT_FOUND: "Medicine not found or inactive.",
  BRANCH_NOT_IN_HOSPITAL: "Branch does not belong to this hospital.",
  INSUFFICIENT_STOCK: "Not enough stock available for this operation.",
  REASON_REQUIRED: "A reason is required for stock-out and adjustment transactions.",
  RECEIVE_SUCCESS: "Stock received successfully.",
  ADJUST_SUCCESS: "Stock adjusted successfully.",
  UPDATE_SUCCESS: "Inventory updated successfully.",
} as const;
