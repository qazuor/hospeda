import { BuiltinRoleTypeEnum, StateEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { getDb } from '../../client.js';
import { roles } from '../../schema';
import { dbLogger } from '../../utils/logger.js';

/**
 * Seeds the required roles
 */
export async function seedRoles() {
    dbLogger.info({ location: 'seedRoles' }, 'Starting to seed roles');

    try {
        const db = getDb();

        // Define the built-in roles
        const builtinRoles = [
            {
                id: crypto.randomUUID(),
                name: BuiltinRoleTypeEnum.ADMIN,
                displayName: 'Administrator',
                description: 'Full access to all system features',
                isBuiltIn: true,
                isDefault: false,
                state: StateEnum.ACTIVE,
                adminInfo: {
                    notes: 'Built-in administrator role',
                    favorite: true
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: crypto.randomUUID(),
                name: BuiltinRoleTypeEnum.EDITOR,
                displayName: 'Editor',
                description: 'Can edit content but cannot manage users or system settings',
                isBuiltIn: true,
                isDefault: false,
                state: StateEnum.ACTIVE,
                adminInfo: {
                    notes: 'Built-in editor role',
                    favorite: true
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: crypto.randomUUID(),
                name: BuiltinRoleTypeEnum.CLIENT,
                displayName: 'Client',
                description: 'Can manage their own accommodations and bookings',
                isBuiltIn: true,
                isDefault: false,
                state: StateEnum.ACTIVE,
                adminInfo: {
                    notes: 'Built-in client role',
                    favorite: true
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: crypto.randomUUID(),
                name: BuiltinRoleTypeEnum.USER,
                displayName: 'User',
                description: 'Basic user with limited access',
                isBuiltIn: true,
                isDefault: true,
                state: StateEnum.ACTIVE,
                adminInfo: {
                    notes: 'Built-in user role',
                    favorite: true
                },
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        // Check which roles already exist
        const existingRoles = await Promise.all(
            builtinRoles.map(async (role) => {
                const found = await db.select().from(roles).where(eq(roles.name, role.name));
                return { role, exists: found.length > 0 };
            })
        );

        // Insert only roles that don't exist
        const rolesToCreate = existingRoles.filter((item) => !item.exists).map((item) => item.role);

        if (rolesToCreate.length === 0) {
            dbLogger.info({ location: 'seedRoles' }, 'All roles already exist, skipping');
            return;
        }

        const createdRoles = await db.insert(roles).values(rolesToCreate).returning();

        if (Array.isArray(createdRoles)) {
            for (const role of createdRoles) {
                dbLogger.query('insert', 'roles', { name: role.name }, role);
            }

            dbLogger.info({ location: 'seedRoles' }, `Created ${createdRoles.length} new roles`);
        }
    } catch (error) {
        dbLogger.error(error as Error, 'Failed to seed roles in seedRoles');
        throw error;
    }
}
