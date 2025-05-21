import { logger } from '@repo/logger';
import { BuiltinPermissionTypeEnum, BuiltinRoleTypeEnum, StateEnum } from '@repo/types';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../client.js';
import { permissions, rolePermissions, roles } from '../../schema';

/**
 * Seeds the required permissions and assigns them to roles
 */
export async function seedPermissions() {
    logger.info('Starting to seed permissions', 'seedPermissions');

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
            logger.info('All permissions already exist, skipping creation', 'seedPermissions');
        } else {
            const createdPermissions = await db
                .insert(permissions)
                .values(permissionsToCreate)
                .returning();

            if (Array.isArray(createdPermissions)) {
                for (const permission of createdPermissions) {
                    logger.query('insert', 'permissions', { name: permission.name }, permission);
                }

                logger.info(
                    `Created ${createdPermissions.length} new permissions`,
                    'seedPermissions'
                );
            }
        }

        // Now assign permissions to roles
        logger.info('Assigning permissions to roles', 'seedPermissions');

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

                    logger.query(
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

            logger.info(`Assigned permissions to role: ${role.name}`, 'seedPermissions');
        }

        logger.info('Finished assigning permissions to roles', 'seedPermissions');
    } catch (error) {
        logger.error('Failed to seed permissions', 'seedPermissions', error);
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
