import { dbLogger } from '../../../utils/logger.js';
import { seedChajariDestination } from './chajarí.required.seed.js';
import { seedColonDestination } from './colon.required.seed.js';
import { seedConcepcionDelUruguayDestination } from './concepcion-del-uruguay.required.seed.js';
import { seedConcordiaDestination } from './concordia.required.seed.js';
import { seedFederacionDestination } from './federacion.required.seed.js';
import { seedGualeguaychuDestination } from './gualeguaychu.required.seed.js';
import { seedIbicuyDestination } from './ibicuy.required.seed.js';
import { seedLiebigDestination } from './liebig.required.seed.js';
import { seedPuertoYeruaDestination } from './puerto-yerua.required.seed.js';
import { seedSanJoseDestination } from './san-jose.required.seed.js';
import { seedSantaAnaDestination } from './santa-ana.required.seed.js';
import { seedUbajayDestination } from './ubajay.required.seed.js';
import { seedVillaElisaDestination } from './villa-elisa.required.seed.js';
import { seedVillaParanacitoDestination } from './villa-paranacito.required.seed.js';

/**
 * Seeds all required destinations
 */
export async function seedDestinations() {
    dbLogger.info({ location: 'seedDestinations' }, 'Starting to seed all required destinations');

    try {
        await seedColonDestination();
        await seedConcordiaDestination();
        await seedGualeguaychuDestination();
        await seedFederacionDestination();
        await seedVillaParanacitoDestination();
        await seedSanJoseDestination();
        await seedVillaElisaDestination();
        await seedChajariDestination();
        await seedConcepcionDelUruguayDestination();
        await seedLiebigDestination();
        await seedPuertoYeruaDestination();
        await seedUbajayDestination();
        await seedSantaAnaDestination();
        await seedIbicuyDestination();

        dbLogger.info(
            { location: 'seedDestinations' },
            'All required destinations seeded successfully'
        );
    } catch (error) {
        dbLogger.error(error as Error, 'Failed to seed required destinations in seedDestinations');
        throw error;
    }
}

export * from './chajarí.required.seed.js';
export * from './colon.required.seed.js';
export * from './concepcion-del-uruguay.required.seed.js';
export * from './concordia.required.seed.js';
export * from './federacion.required.seed.js';
export * from './gualeguaychu.required.seed.js';
export * from './ibicuy.required.seed.js';
export * from './liebig.required.seed.js';
export * from './puerto-yerua.required.seed.js';
export * from './san-jose.required.seed.js';
export * from './santa-ana.required.seed.js';
export * from './ubajay.required.seed.js';
export * from './villa-elisa.required.seed.js';
export * from './villa-paranacito.required.seed.js';
