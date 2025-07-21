import { UserModel } from '@repo/db';
import type { Actor } from '@repo/service-core';
import { type PermissionEnum, RoleEnum } from '@repo/types';
import superAdminInput from '../data/user/required/super-admin-user.json';
import { logger } from './logger.js';

/**
 * Normalizes user data by removing schema and ID fields that shouldn't be sent to the service
 */
const normalizeUserData = (userData: Record<string, unknown>) => {
    const { $schema, id, ...normalizedData } = userData;
    return normalizedData;
};

/**
 * Loads the super admin user and returns its actor information.
 * This function creates the super admin user directly using the model to bypass
 * foreign key validation issues during initial seeding.
 */
export async function loadSuperAdminAndGetActor(): Promise<Actor> {
    const separator = '#'.repeat(90);
    const subSeparator = '─'.repeat(90);

    logger.info(`${separator}`);
    logger.info('👑  CARGANDO SUPER ADMINISTRADOR');
    logger.info(`${subSeparator}`);

    try {
        const userModel = new UserModel();

        // Check if super admin already exists
        const existingSuperAdmin = await userModel.findOne({
            role: RoleEnum.SUPER_ADMIN
        });

        if (existingSuperAdmin) {
            logger.success(
                `👑 Super admin encontrado: "${existingSuperAdmin.displayName || 'Super Admin'}" (ID: ${existingSuperAdmin.id})`
            );
            logger.info(`${subSeparator}`);

            return {
                id: existingSuperAdmin.id,
                role: existingSuperAdmin.role as RoleEnum,
                permissions: existingSuperAdmin.permissions
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
            `👑 Super admin creado: "${createdUser.displayName || 'Super Admin'}" (ID: ${realSuperAdminId})`
        );
        logger.info(`${subSeparator}`);

        return {
            id: realSuperAdminId,
            role: superAdminInput.role as RoleEnum,
            permissions: superAdminInput.permissions as PermissionEnum[]
        };
    } catch (error) {
        logger.error(`❌ Error al cargar super admin: ${(error as Error).message}`);
        throw error;
    }
}
