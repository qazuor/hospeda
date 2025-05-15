import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, StateEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { db } from '../../client';
import { roles } from '../../schema';

/**
 * Seeds the required roles
 */
export async function seedRoles() {
    logger.info('Starting to seed roles', 'seedRoles');

    try {
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
            logger.info('All roles already exist, skipping', 'seedRoles');
            return;
        }

        const createdRoles = await db.insert(roles).values(rolesToCreate).returning();

        if (Array.isArray(createdRoles)) {
            for (const role of createdRoles) {
                logger.query('insert', 'roles', { name: role.name }, role);
            }

            logger.info(`Created ${createdRoles.length} new roles`, 'seedRoles');
        }
    } catch (error) {
        logger.error('Failed to seed roles', 'seedRoles', error);
        throw error;
    }
}
