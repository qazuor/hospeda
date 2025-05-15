import { logger } from '@repo/logger';
import { seedChajariDestination } from 'src/seeds/required/destination/chajarí.required.seed';
import { seedColonDestination } from 'src/seeds/required/destination/colon.required.seed';
import { seedConcepcionDelUruguayDestination } from 'src/seeds/required/destination/concepcion-del-uruguay.required.seed';
import { seedConcordiaDestination } from 'src/seeds/required/destination/concordia.required.seed';
import { seedFederacionDestination } from 'src/seeds/required/destination/federacion.required.seed';
import { seedGualeguaychuDestination } from 'src/seeds/required/destination/gualeguaychu.required.seed';
import { seedIbicuyDestination } from 'src/seeds/required/destination/ibicuy.required.seed';
import { seedLiebigDestination } from 'src/seeds/required/destination/liebig.required.seed';
import { seedPuertoYeruaDestination } from 'src/seeds/required/destination/puerto-yerua.required.seed';
import { seedSanJoseDestination } from 'src/seeds/required/destination/san-jose.required.seed';
import { seedSantaAnaDestination } from 'src/seeds/required/destination/santa-ana.required.seed';
import { seedUbajayDestination } from 'src/seeds/required/destination/ubajay.required.seed';
import { seedVillaElisaDestination } from 'src/seeds/required/destination/villa-elisa.required.seed';
import { seedVillaParanacitoDestination } from 'src/seeds/required/destination/villa-paranacito.required.seed';

/**
 * Seeds all required destinations
 */
export async function seedDestinations() {
    logger.info('Starting to seed all required destinations', 'seedDestinations');

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

        logger.info('All required destinations seeded successfully', 'seedDestinations');
    } catch (error) {
        logger.error('Failed to seed required destinations', 'seedDestinations', error);
        throw error;
    }
}

export * from './chajarí.required.seed';
export * from './colon.required.seed';
export * from './concepcion-del-uruguay.required.seed';
export * from './concordia.required.seed';
export * from './federacion.required.seed';
export * from './gualeguaychu.required.seed';
export * from './liebig.required.seed';
export * from './puerto-yerua.required.seed';
export * from './san-jose.required.seed';
export * from './santa-ana.required.seed';
export * from './ubajay.required.seed';
export * from './villa-elisa.required.seed';
export * from './villa-paranacito.required.seed';

export * from './ibicuy.required.seed';
