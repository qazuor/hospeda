import { logger } from '@repo/logger';
import { seedRequiredAmenities } from './amenities.required.seed';
import { seedDestinations } from './destination';
import { seedPermissions } from './permissions.required.seed';
import { seedRoles } from './roles.required.seed';
import { seedAdminUser } from './user.required.seed';

/**
 * Seeds all required data in the correct order
 */
export async function seedRequiredData() {
    logger.info('Starting to seed required data', 'seedRequiredData');

    try {
        // Seed in order of dependencies
        await seedRoles();
        await seedPermissions();
        await seedAdminUser();
        await seedDestinations();
        await seedRequiredAmenities();

        logger.info('Successfully seeded all required data', 'seedRequiredData');
    } catch (error) {
        logger.error('Failed to seed required data', 'seedRequiredData', error);
        throw error;
    }
}

export * from './amenities.required.seed';
export * from './destination';
export * from './permissions.required.seed';
export * from './roles.required.seed';
export * from './user.required.seed';
