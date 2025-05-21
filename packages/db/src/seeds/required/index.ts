import { dbLogger } from '../../utils/logger.js';
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
    dbLogger.info({ location: 'seedRequiredData' }, 'Starting to seed required data');

    try {
        // Seed in order of dependencies
        await seedRoles();
        await seedPermissions();
        await seedAdminUser();
        await seedDestinations();
        await seedRequiredAmenities();
        await seedRequiredFeatures();

        dbLogger.info({ location: 'seedRequiredData' }, 'Successfully seeded all required data');
    } catch (error) {
        dbLogger.error(error as Error, 'Failed to seed required data in seedRequiredData');
        throw error;
    }
}

export * from './amenities.required.seed.js';
export * from './destination';
export * from './features.required.seed.js';
export * from './permissions.required.seed.js';
export * from './roles.required.seed.js';
export * from './user.required.seed.js';
