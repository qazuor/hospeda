import { BuiltinPermissionTypeEnum, BuiltinRoleTypeEnum, StateEnum } from '@repo/types';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../client.js';
import { permissions, rolePermissions, roles } from '../../schema';
import { dbLogger } from '../../utils/logger.js';

/**
 * Seeds the required permissions and assigns them to roles
 */
export async function seedPermissions() {
    dbLogger.info({ location: 'seedPermissions' }, 'Starting to seed permissions');

    try {
        const db = getDb();

        // Define the built-in permissions
        const builtinPermissions = Object.values(BuiltinPermissionTypeEnum).map((permName) => ({
            id: crypto.randomUUID(),
            name: permName,
            displayName: formatPermissionName(permName),
            description: getPermissionDescription(permName),
            isBuiltIn: true,
            state: StateEnum.ACTIVE,
            adminInfo: {
                notes: 'Built-in permission created by seed',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        // Check which permissions already exist
        const existingPermissions = await Promise.all(
            builtinPermissions.map(async (permission) => {
                const found = await db
                    .select()
                    .from(permissions)
                    .where(eq(permissions.name, permission.name));
                return { permission, exists: found.length > 0 };
            })
        );

        // Insert only permissions that don't exist
        const permissionsToCreate = existingPermissions
            .filter((item) => !item.exists)
            .map((item) => item.permission);

        if (permissionsToCreate.length === 0) {
            dbLogger.info(
                { location: 'seedPermissions' },
                'All permissions already exist, skipping creation'
            );
        } else {
            const createdPermissions = await db
                .insert(permissions)
                .values(permissionsToCreate)
                .returning();

            if (Array.isArray(createdPermissions)) {
                for (const permission of createdPermissions) {
                    dbLogger.query('insert', 'permissions', { name: permission.name }, permission);
                }

                dbLogger.info(
                    { location: 'seedPermissions' },
                    `Created ${createdPermissions.length} new permissions`
                );
            }
        }

        // Now assign permissions to roles
        dbLogger.info({ location: 'seedPermissions' }, 'Assigning permissions to roles');

        // Get all roles
        const allRoles = await db.select().from(roles);

        // Get all permissions
        const allPermissions = await db.select().from(permissions);

        if (!Array.isArray(allRoles) || !Array.isArray(allPermissions)) {
            throw new Error('Failed to retrieve roles or permissions');
        }

        // Assign permissions based on role
        for (const role of allRoles) {
            let permissionsToAssign: typeof allPermissions = [];

            if (role.name === BuiltinRoleTypeEnum.ADMIN) {
                // Admin gets all permissions
                permissionsToAssign = allPermissions;
            } else if (role.name === BuiltinRoleTypeEnum.EDITOR) {
                // Editor gets content-related permissions
                permissionsToAssign = allPermissions.filter(
                    (p) =>
                        p.name.includes('_CREATE') ||
                        p.name.includes('_UPDATE') ||
                        p.name.includes('_DELETE')
                );
            } else if (role.name === BuiltinRoleTypeEnum.CLIENT) {
                // Client gets accommodation and event permissions
                permissionsToAssign = allPermissions.filter(
                    (p) => p.name.includes('ACCOMMODATION_') || p.name.includes('EVENT_')
                );
            } else if (role.name === BuiltinRoleTypeEnum.USER) {
                // User gets minimal permissions
                permissionsToAssign = [];
            }

            // For each permission to assign
            for (const permission of permissionsToAssign) {
                // Check if the role-permission relation already exists
                const existingRelation = await db
                    .select()
                    .from(rolePermissions)
                    .where(
                        and(
                            eq(rolePermissions.roleId, role.id),
                            eq(rolePermissions.permissionId, permission.id)
                        )
                    );

                if (existingRelation.length === 0) {
                    // Create the relation if it doesn't exist
                    await db.insert(rolePermissions).values({
                        roleId: role.id,
                        permissionId: permission.id
                    });

                    dbLogger.query(
                        'insert',
                        'role_permissions',
                        {
                            roleId: role.id,
                            permissionId: permission.id
                        },
                        { success: true }
                    );
                }
            }

            dbLogger.info(
                { location: 'seedPermissions' },
                `Assigned permissions to role: ${role.name}`
            );
        }

        dbLogger.info({ location: 'seedPermissions' }, 'Finished assigning permissions to roles');
    } catch (error) {
        dbLogger.error(error as Error, 'Failed to seed permissions in seedPermissions');
        throw error;
    }
}

/**
 * Formats a permission name for display
 * @param name - The permission name from enum
 * @returns Formatted display name
 */
function formatPermissionName(name: string): string {
    return name
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Gets a description for a permission
 * @param name - The permission name from enum
 * @returns Description of what the permission allows
 */
function getPermissionDescription(name: string): string {
    const parts = name.split('_');
    if (parts.length < 2) {
        return `Permission to perform ${name.toLowerCase()} operations.`;
    }

    const entity = parts[0];
    const action = parts[1];

    const entityMap: Record<string, string> = {
        USER: 'user accounts',
        DESTINATION: 'destination listings',
        ACCOMMODATION: 'accommodation listings',
        EVENT: 'event listings',
        POST: 'blog posts'
    };

    const actionMap: Record<string, string> = {
        CREATE: 'create new',
        UPDATE: 'modify existing',
        DELETE: 'remove'
    };

    const entityDesc =
        entity && entityMap[entity as keyof typeof entityMap]
            ? entityMap[entity as keyof typeof entityMap]
            : entity
              ? entity.toLowerCase()
              : '';
    const actionDesc = action ? actionMap[action] || action.toLowerCase() : '';

    return `Permission to ${actionDesc} ${entityDesc} in the system.`;
}
