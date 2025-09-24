import { UserModel } from '@repo/db';
import { AuthProviderEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import superAdminInput from '../data/user/required/super-admin-user.json';
import { STATUS_ICONS } from './icons.js';
import { logger } from './logger.js';
import { summaryTracker } from './summaryTracker.js';

/**
 * Updates Clerk user metadata with the database user ID
 */
const updateClerkMetadata = async (clerkUserId: string, dbUserId: string): Promise<void> => {
    try {
        const clerkSecretKey = process.env.CLERK_SECRET_KEY;
        if (!clerkSecretKey) {
            logger.warn(`${STATUS_ICONS.Warning} CLERK_SECRET_KEY not found, skipping metadata update`);
            return;
        }

        const response = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}/metadata`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${clerkSecretKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                private_metadata: {
                    userId: dbUserId,
                    role: 'SUPER_ADMIN',
                    updatedAt: new Date().toISOString(),
                    source: 'seed'
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Clerk API error: ${response.status} - ${errorText}`);
        }

        logger.success({
            msg: `${STATUS_ICONS.Success} Clerk metadata updated for user ${clerkUserId}`
        });
    } catch (error) {
        logger.warn(`${STATUS_ICONS.Warning} Failed to update Clerk metadata: ${(error as Error).message}`);
    }
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

        const seedAuthProvider: AuthProviderEnum =
            (process.env.SEED_AUTH_PROVIDER as AuthProviderEnum | undefined) ??
            AuthProviderEnum.CLERK;
        const seedSuperAdminAuthProviderUserId = process.env.SEED_SUPER_ADMIN_AUTH_PROVIDER_USER_ID;

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

            // Optionally link auth provider id if provided and not already set
            try {
                if (
                    seedSuperAdminAuthProviderUserId &&
                    (!('authProviderUserId' in existingSuperAdmin) ||
                        !existingSuperAdmin.authProviderUserId)
                ) {
                    await userModel.updateById(existingSuperAdmin.id, {
                        authProvider: seedAuthProvider,
                        authProviderUserId: seedSuperAdminAuthProviderUserId
                    } as Record<string, unknown>);
                    logger.info(
                        `${STATUS_ICONS.Success} Linked super admin with auth provider (${seedAuthProvider})`
                    );
                    
                    // Update Clerk metadata with the database user ID
                    await updateClerkMetadata(seedSuperAdminAuthProviderUserId, existingSuperAdmin.id);
                } else if (!seedSuperAdminAuthProviderUserId) {
                    logger.warn(
                        `${STATUS_ICONS.Warning} SEED_SUPER_ADMIN_AUTH_PROVIDER_USER_ID not set; super admin won't be linked to auth provider`
                    );
                }
            } catch (e) {
                logger.warn(
                    `${STATUS_ICONS.Warning} Could not link super admin to auth provider: ${(e as Error).message}`
                );
            }

            return {
                id: existingSuperAdmin.id,
                role: existingSuperAdmin.role as RoleEnum,
                permissions: Object.values(PermissionEnum)
            };
        }

        // Create super admin user
        const normalizedSuperAdminInput = normalizeUserData(superAdminInput);
        const createdUser = await userModel.create({
            ...(normalizedSuperAdminInput as Record<string, unknown>),
            ...(seedSuperAdminAuthProviderUserId
                ? {
                      authProvider: seedAuthProvider,
                      authProviderUserId: seedSuperAdminAuthProviderUserId
                  }
                : {})
        });

        if (!createdUser) {
            throw new Error('Failed to create super admin user');
        }

        const realSuperAdminId = createdUser.id;

        logger.success({
            msg: `${STATUS_ICONS.UserSuperAdmin} Super admin created: "${createdUser.displayName || 'Super Admin'}" (ID: ${realSuperAdminId})`
        });
        
        // Update Clerk metadata with the database user ID if authProviderUserId exists
        const authProviderUserId = createdUser.authProviderUserId || 
                                 seedSuperAdminAuthProviderUserId || 
                                 superAdminInput.authProviderUserId;
        if (authProviderUserId) {
            await updateClerkMetadata(authProviderUserId, realSuperAdminId);
        }
        
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
