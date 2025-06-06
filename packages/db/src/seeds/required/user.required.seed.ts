import { BuiltinRoleTypeEnum, PreferedContactEnum, StateEnum } from '@repo/types';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { getDb } from '../../client.js';
import { roles, users } from '../../schema';
import { dbLogger } from '../../utils/logger.js';

/**
 * Seeds the required admin user
 */
export async function seedAdminUser() {
    dbLogger.info({ location: 'seedAdminUser' }, 'Starting to seed admin user');

    try {
        const db = getDb();

        // Check if admin user already exists
        const existingAdmin = await db.select().from(users).where(eq(users.userName, 'admin'));

        if (existingAdmin.length > 0) {
            dbLogger.info({ location: 'seedAdminUser' }, 'Admin user already exists, skipping');
            return;
        }

        // Get admin role
        const adminRole = await db
            .select()
            .from(roles)
            .where(eq(roles.name, BuiltinRoleTypeEnum.ADMIN));

        if (!adminRole || adminRole.length === 0) {
            throw new Error('Admin role not found. Please seed roles first.');
        }

        const adminRoleId = adminRole[0]?.id;
        if (!adminRoleId) {
            throw new Error('Admin role ID is undefined');
        }

        // Create admin user
        const passwordHash = await bcrypt.hash('admin', 10);

        const adminUser = await db.insert(users).values({
            id: crypto.randomUUID(),
            name: 'admin',
            displayName: 'Admin User',
            userName: 'admin',
            passwordHash,
            firstName: 'Leandro',
            lastName: 'Asrilevich',
            state: StateEnum.ACTIVE,
            roleId: adminRoleId,
            emailVerified: true,
            phoneVerified: true,
            contactInfo: {
                personalEmail: 'qazuor@gmail.com',
                mobilePhone: '5493442453797',
                preferredEmail: PreferedContactEnum.HOME,
                preferredPhone: PreferedContactEnum.MOBILE
            },
            profile: {
                bio: 'System administrator',
                avatar: 'https://i.pravatar.cc/300'
            },
            settings: {
                darkMode: true,
                language: 'es',
                notifications: {
                    enabled: true,
                    allowEmails: true,
                    allowSms: true,
                    allowPush: true
                }
            },
            adminInfo: {
                notes: 'Default admin user created by seed',
                favorite: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        dbLogger.info({ location: 'seedAdminUser' }, 'Admin user created successfully');
        dbLogger.query('insert', 'users', { userName: 'admin' }, adminUser);
    } catch (error) {
        dbLogger.error(error as Error, 'Failed to seed admin user in seedAdminUser');
        throw error;
    }
}
