import { Role, SYSTEM_ROLES } from "../modules/roles/model/roles.model";

const DEFAULT_ROLES: { name: string; description: string }[] = [
  {
    name: SYSTEM_ROLES.ADMIN,
    description:
      "Full access to manage the entire IMSN platform across all hospitals.",
  },
  {
    name: SYSTEM_ROLES.HOSPITAL_MANAGER,
    description:
      "Manages a single hospital, its branches, staff, inventory, and exchanges.",
  },
  {
    name: SYSTEM_ROLES.PHARMACIST,
    description:
      "Manages branch-level inventory and creates medicine exchange requests.",
  },
  {
    name: SYSTEM_ROLES.VIEWER,
    description:
      "Read-only access to a hospital's data for reporting and analysis.",
  },
];

/**
 * Idempotently ensures the four system roles exist so new users always have
 * a valid role to be assigned during registration. Safe to call on every
 * server start.
 */
export async function seedSystemRoles(): Promise<void> {
  for (const role of DEFAULT_ROLES) {
    await Role.updateOne(
      { name: role.name },
      {
        $setOnInsert: {
          name: role.name,
          description: role.description,
          permissions: [],
          isActive: true,
          isSystem: true,
        },
      },
      { upsert: true }
    );
  }
}
