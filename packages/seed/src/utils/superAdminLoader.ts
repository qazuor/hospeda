import { UserModel } from '@repo/db';
import type { Actor } from '@repo/service-core';
import { PermissionEnum, RoleEnum } from '@repo/types';
import superAdminInput from '../data/user/required/super-admin-user.json';
import { STATUS_ICONS } from './icons.js';
import { logger } from './logger.js';
import { summaryTracker } from './summaryTracker.js';

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
 * Loads the super admin user and returns its actor information.
 *
 * This function creates the super admin user directly using the model to bypass
 * foreign key validation issues during initial seeding. It ensures that:
 * - Only one super admin exists in the system
 * - The super admin has all available permissions
 * - The actor is properly configured for subsequent operations
 *
 * The super admin is essential for the seeding process as it provides the
 * necessary permissions to create all other entities in the system.
 *
 * @returns Promise that resolves to the super admin actor
 *
 * @example
 * ```typescript
 * const superAdminActor = await loadSuperAdminAndGetActor();
 * // Returns actor with:
 * // - id: super admin user ID
 * // - role: SUPER_ADMIN
 * // - permissions: all available permissions
 * ```
 *
 * @throws {Error} When super admin creation fails
 */
export async function loadSuperAdminAndGetActor(): Promise<Actor> {
    const separator = '#'.repeat(90);
    const subSeparator = '─'.repeat(90);

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
            logger.success(
                `${STATUS_ICONS.UserSuperAdmin} Super admin found: "${existingSuperAdmin.displayName || 'Super Admin'}" (ID: ${existingSuperAdmin.id})`
            );
            logger.info(`${subSeparator}`);

            summaryTracker.trackProcessStep('Super Admin', 'success', 'Existing super admin found');

            return {
                id: existingSuperAdmin.id,
                role: existingSuperAdmin.role as RoleEnum,
                permissions: Object.values(PermissionEnum)
            };
        }

        // Create super admin user
        const normalizedSuperAdminInput = normalizeUserData(superAdminInput);
        const createdUser = await userModel.create(
            normalizedSuperAdminInput as Record<string, unknown>
        );

        if (!createdUser) {
            throw new Error('Failed to create super admin user');
        }

        const realSuperAdminId = createdUser.id;

        logger.success(
            `${STATUS_ICONS.UserSuperAdmin} Super admin created: "${createdUser.displayName || 'Super Admin'}" (ID: ${realSuperAdminId})`
        );
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
