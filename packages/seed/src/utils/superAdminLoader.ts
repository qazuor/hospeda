import { randomUUID } from 'node:crypto';
import { UserModel, accounts, getDb } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { hash } from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import superAdminInput from '../data/user/required/super-admin-user.json';
import { STATUS_ICONS } from './icons.js';
import { logger } from './logger.js';
import { summaryTracker } from './summaryTracker.js';

/**
 * Generates a cryptographically random password for the super admin seed.
 * Used when HOSPEDA_SEED_SUPER_ADMIN_PASSWORD env var is not set.
 */
const generateRandomPassword = (): string => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('base64url');
};

/**
 * Normalizes user data by removing schema and ID fields that shouldn't be sent to the service.
 *
 * @param userData - Raw user data from JSON file
 * @returns Cleaned user data ready for database insertion
 */
const normalizeUserData = (userData: Record<string, unknown>) => {
    const { $schema, id, ...normalizedData } = userData;
    return normalizedData;
};

/**
 * Creates a Better Auth credential account record for the super admin user.
 * This allows the super admin to sign in with email/password via Better Auth.
 */
const ensureCredentialAccount = async (userId: string, email: string): Promise<void> => {
    const db = getDb();

    // Check if account already exists
    const existing = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
        .limit(1);

    if (existing.length > 0) {
        logger.info(`${STATUS_ICONS.Success} Credential account already exists for super admin`);
        return;
    }

    // Hash the password with bcrypt (matching Better Auth's expected format)
    const envPassword = process.env.HOSPEDA_SEED_SUPER_ADMIN_PASSWORD;
    const password = envPassword || generateRandomPassword();
    if (!envPassword) {
        logger.warn(
            `${STATUS_ICONS.Warning} HOSPEDA_SEED_SUPER_ADMIN_PASSWORD not set. Generated random password for super admin. Set the env var for a predictable password.`
        );
        console.warn(
            `[SEED] Generated super admin password: ${password.slice(0, 4)}${'*'.repeat(Math.max(0, password.length - 4))}`
        );
        console.warn('[SEED] Change this password immediately after first login.');
    }
    const hashedPassword = await hash(password, 10);

    await db.insert(accounts).values({
        id: randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    logger.success({
        msg: `${STATUS_ICONS.Success} Credential account created for super admin (email: ${email})`
    });
};

/**
 * Loads the super admin user and returns its actor information.
 *
 * This function creates the super admin user directly using the model to bypass
 * foreign key validation issues during initial seeding. It ensures that:
 * - Only one super admin exists in the system
 * - The super admin has all available permissions
 * - A credential account exists for Better Auth email/password login
 * - The actor is properly configured for subsequent operations
 *
 * The super admin is essential for the seeding process as it provides the
 * necessary permissions to create all other entities in the system.
 *
 * @returns Promise that resolves to the super admin actor
 *
 * @throws {Error} When super admin creation fails
 */
export async function loadSuperAdminAndGetActor(): Promise<Actor> {
    const separator = '#'.repeat(90);
    const subSeparator = '\u2500'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.UserSuperAdmin}  LOADING SUPER ADMINISTRATOR`);
    logger.info(`${subSeparator}`);

    try {
        const userModel = new UserModel();

        // Check if super admin already exists
        const existingSuperAdmin = await userModel.findOne({
            role: RoleEnum.SUPER_ADMIN
        });

        if (existingSuperAdmin) {
            logger.success({
                msg: `${STATUS_ICONS.UserSuperAdmin} Super admin found: "${existingSuperAdmin.displayName || 'Super Admin'}" (ID: ${existingSuperAdmin.id})`
            });
            logger.info(`${subSeparator}`);

            summaryTracker.trackProcessStep('Super Admin', 'success', 'Existing super admin found');

            // Ensure credential account exists for Better Auth login
            const email =
                ((existingSuperAdmin as Record<string, unknown>).email as string) ||
                superAdminInput.email;
            await ensureCredentialAccount(existingSuperAdmin.id, email);

            return {
                id: existingSuperAdmin.id,
                role: existingSuperAdmin.role as RoleEnum,
                permissions: Object.values(PermissionEnum)
            };
        }

        // Create super admin user with forced password change on first login
        const normalizedSuperAdminInput = normalizeUserData(superAdminInput);
        const createdUser = await userModel.create({
            ...(normalizedSuperAdminInput as Record<string, unknown>),
            adminInfo: {
                notes: undefined,
                favorite: false,
                passwordChangeRequired: true
            }
        });

        if (!createdUser) {
            throw new Error('Failed to create super admin user');
        }

        const realSuperAdminId = createdUser.id;

        logger.success({
            msg: `${STATUS_ICONS.UserSuperAdmin} Super admin created: "${createdUser.displayName || 'Super Admin'}" (ID: ${realSuperAdminId})`
        });

        // Create credential account for Better Auth email/password login
        await ensureCredentialAccount(realSuperAdminId, superAdminInput.email);

        logger.info(`${subSeparator}`);

        summaryTracker.trackProcessStep(
            'Super Admin',
            'success',
            'Super admin created successfully'
        );

        return {
            id: realSuperAdminId,
            role: superAdminInput.role as RoleEnum,
            permissions: Object.values(PermissionEnum)
        };
    } catch (error) {
        logger.error(
            `${STATUS_ICONS.Error} Error loading super admin: ${(error as Error).message}`
        );
        summaryTracker.trackProcessStep(
            'Super Admin',
            'error',
            'Error loading super admin',
            (error as Error).message
        );
        throw error;
    }
}
