import { logger } from '@repo/logger';
import { seedRequiredAmenities } from './amenities.required.seed.js';
import { seedDestinations } from './destination';
import { seedRequiredFeatures } from './features.required.seed.js';
import { seedPermissions } from './permissions.required.seed.js';
import { seedRoles } from './roles.required.seed.js';
import { seedAdminUser } from './user.required.seed.js';

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
        await seedRequiredFeatures();

        logger.info('Successfully seeded all required data', 'seedRequiredData');
    } catch (error) {
        logger.error('Failed to seed required data', 'seedRequiredData', error);
        throw error;
    }
}

export * from './amenities.required.seed.js';
export * from './destination';
export * from './features.required.seed.js';
export * from './permissions.required.seed.js';
export * from './roles.required.seed.js';
export * from './user.required.seed.js';
