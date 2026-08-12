import { Role, SYSTEM_ROLES } from "../modules/roles/model/roles.model";
import { PERMISSIONS, PermissionName } from "../constants/permissions";
import { getPermissionIdsByName } from "./permissions.seed";

const DEFAULT_ROLES: {
  name: string;
  description: string;
  permissions: PermissionName[];
}[] = [
  {
    name: SYSTEM_ROLES.ADMIN,
    description:
      "Full access to manage the entire IMSN platform across all hospitals.",
    permissions: Object.values(PERMISSIONS),
  },
  {
    name: SYSTEM_ROLES.HOSPITAL_MANAGER,
    description:
      "Manages a single hospital, its branches, staff, inventory, and exchanges.",
    permissions: [
      PERMISSIONS.MANAGE_OWN_HOSPITAL,
      PERMISSIONS.MANAGE_USERS,
      PERMISSIONS.MANAGE_INVENTORY,
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.CREATE_EXCHANGE_REQUEST,
      PERMISSIONS.APPROVE_EXCHANGE_REQUEST,
      PERMISSIONS.VIEW_REPORTS,
    ],
  },
  {
    name: SYSTEM_ROLES.PHARMACIST,
    description:
      "Manages branch-level inventory and creates medicine exchange requests.",
    permissions: [
      PERMISSIONS.MANAGE_INVENTORY,
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.CREATE_EXCHANGE_REQUEST,
      PERMISSIONS.VIEW_REPORTS,
    ],
  },
  {
    name: SYSTEM_ROLES.VIEWER,
    description:
      "Read-only access to a hospital's data for reporting and analysis.",
    permissions: [PERMISSIONS.VIEW_INVENTORY, PERMISSIONS.VIEW_REPORTS],
  },
];

/**
 * Idempotently ensures the four system roles exist, with their permission
 * set kept in sync with DEFAULT_ROLES on every boot (so a permission added
 * here takes effect without a manual migration). Must run after
 * seedPermissions(). Safe to call on every server start.
 */
export async function seedSystemRoles(): Promise<void> {
  for (const role of DEFAULT_ROLES) {
    const permissionIds = await getPermissionIdsByName(role.permissions);

    await Role.updateOne(
      { name: role.name },
      {
        $set: {
          description: role.description,
          permissions: permissionIds,
          isActive: true,
          isSystem: true,
        },
      },
      { upsert: true }
    );
  }
}
