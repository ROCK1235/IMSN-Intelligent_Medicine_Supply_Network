/**
 * Canonical permission name constants — used by the RBAC seed
 * (seed/permissions.seed.ts, seed/roles.seed.ts) and by authorize()
 * middleware calls. Never hardcode a permission name string elsewhere.
 */
export const PERMISSIONS = {
  MANAGE_SYSTEM: "MANAGE_SYSTEM", // admin: system settings, role/permission management
  MANAGE_HOSPITALS: "MANAGE_HOSPITALS", // admin: create/verify/deactivate any hospital
  MANAGE_OWN_HOSPITAL: "MANAGE_OWN_HOSPITAL", // hospital_manager: edit own hospital/branches
  MANAGE_USERS: "MANAGE_USERS", // admin (all) / hospital_manager (own hospital): create/edit/deactivate staff
  MANAGE_MEDICINE_CATALOG: "MANAGE_MEDICINE_CATALOG", // admin: medicines/categories/manufacturers master data
  MANAGE_INVENTORY: "MANAGE_INVENTORY", // hospital_manager, pharmacist: stock in/out, batches
  VIEW_INVENTORY: "VIEW_INVENTORY", // all roles, own hospital
  CREATE_EXCHANGE_REQUEST: "CREATE_EXCHANGE_REQUEST", // hospital_manager, pharmacist
  APPROVE_EXCHANGE_REQUEST: "APPROVE_EXCHANGE_REQUEST", // admin, hospital_manager
  VIEW_REPORTS: "VIEW_REPORTS", // all roles, own hospital
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
