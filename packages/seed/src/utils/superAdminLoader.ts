import path from 'node:path';
import { UserModel } from '@repo/db';
import type { Actor } from '@repo/service-core';
import type { PermissionEnum, RoleEnum } from '@repo/types';
import { loadJsonFiles } from './loadJsonFile.js';
import { logger } from './logger.js';

/**
 * Normalizes user data by removing schema and ID fields that shouldn't be sent to the service
 */
const normalizeUserData = (userData: Record<string, unknown>) => {
    const { $schema, id, ...normalizedData } = userData;
    return normalizedData;
};

/**
 * Loads the super admin user first and returns its real ID from the database.
 * This function should be called before any other seeding operations.
 *
 * @returns Promise<Actor> The super admin actor with the real ID from the database
 */
export async function loadSuperAdminAndGetActor(): Promise<Actor> {
    const separator = '─'.repeat(60);

    logger.info(`\n${separator}`);
    logger.info('👑 CARGANDO SUPER ADMINISTRADOR');
    logger.info(`${separator}`);

    const folder = path.resolve('src/data/user/required');
    const files = ['super-admin-user.json'];

    // Load only the super admin user file
    const users = await loadJsonFiles(folder, files);

    if (users.length === 0) {
        throw new Error('No se encontró el archivo super-admin-user.json');
    }

    const userModel = new UserModel();
    const superAdminInput = users[0] as Record<string, unknown>;

    // Normalize the user data by removing schema and ID fields
    const normalizedSuperAdminInput = normalizeUserData(superAdminInput);

    // Create the super admin user directly using the model to avoid foreign key constraints
    // biome-ignore lint/suspicious/noExplicitAny: Service input type is complex, using any for now
    const createdUser = await userModel.create(normalizedSuperAdminInput as any);

    if (!createdUser?.id) {
        throw new Error('❌ Super admin created but no ID returned');
    }

    const realSuperAdminId = createdUser.id;
    const displayName = superAdminInput.displayName as string;

    logger.success(`   👑 Super admin cargado: "${displayName}" (ID: ${realSuperAdminId})`);
    logger.info(`${separator}\n`);

    // Return the real actor with the actual ID from the database
    return {
        id: realSuperAdminId,
        role: superAdminInput.role as RoleEnum,
        permissions: superAdminInput.permissions as PermissionEnum[]
    };
}
