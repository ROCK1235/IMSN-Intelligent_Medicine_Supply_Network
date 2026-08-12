import { Permission, IPermission } from "../modules/permissions/model/permissions.model";
import { PERMISSIONS, PermissionName } from "../constants/permissions";

interface PermissionDefinition {
  name: PermissionName;
  description: string;
  resource: string;
  action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "APPROVE";
  scope: "own" | "own_hospital" | "all";
}

const DEFAULT_PERMISSIONS: PermissionDefinition[] = [
  {
    name: PERMISSIONS.MANAGE_SYSTEM,
    description: "Manage platform-wide system settings, roles, and permissions.",
    resource: "system",
    action: "UPDATE",
    scope: "all",
  },
  {
    name: PERMISSIONS.MANAGE_HOSPITALS,
    description: "Create, verify, and deactivate any hospital on the platform.",
    resource: "hospital",
    action: "UPDATE",
    scope: "all",
  },
  {
    name: PERMISSIONS.MANAGE_OWN_HOSPITAL,
    description: "Edit own hospital's details and branches.",
    resource: "hospital",
    action: "UPDATE",
    scope: "own_hospital",
  },
  {
    name: PERMISSIONS.MANAGE_USERS,
    description: "Create, edit, and deactivate staff accounts within a hospital.",
    resource: "user",
    action: "UPDATE",
    scope: "own_hospital",
  },
  {
    name: PERMISSIONS.MANAGE_MEDICINE_CATALOG,
    description: "Create and edit medicine master data, categories, and manufacturers.",
    resource: "medicine",
    action: "UPDATE",
    scope: "all",
  },
  {
    name: PERMISSIONS.MANAGE_INVENTORY,
    description: "Update branch-level medicine stock (in/out, batches).",
    resource: "inventory",
    action: "UPDATE",
    scope: "own_hospital",
  },
  {
    name: PERMISSIONS.VIEW_INVENTORY,
    description: "View a hospital's medicine inventory.",
    resource: "inventory",
    action: "READ",
    scope: "own_hospital",
  },
  {
    name: PERMISSIONS.CREATE_EXCHANGE_REQUEST,
    description: "Create a medicine exchange request to another hospital.",
    resource: "exchange",
    action: "CREATE",
    scope: "own_hospital",
  },
  {
    name: PERMISSIONS.APPROVE_EXCHANGE_REQUEST,
    description: "Approve or reject an incoming medicine exchange request.",
    resource: "exchange",
    action: "APPROVE",
    scope: "own_hospital",
  },
  {
    name: PERMISSIONS.VIEW_REPORTS,
    description: "View dashboards and reports for a hospital.",
    resource: "report",
    action: "READ",
    scope: "own_hospital",
  },
];

/**
 * Idempotently ensures the default permission set exists. Must run before
 * seedSystemRoles(), which assigns these to roles by name.
 */
export async function seedPermissions(): Promise<void> {
  for (const permission of DEFAULT_PERMISSIONS) {
    await Permission.updateOne(
      { name: permission.name },
      {
        $setOnInsert: {
          ...permission,
          isActive: true,
        },
      },
      { upsert: true }
    );
  }
}

/**
 * Look up permission ObjectIds by name — used by seedSystemRoles() to assign
 * permissions to roles without hardcoding ids.
 */
export async function getPermissionIdsByName(
  names: PermissionName[]
): Promise<IPermission["_id"][]> {
  const permissions = await Permission.find({ name: { $in: names } });
  return permissions.map((p) => p._id);
}
