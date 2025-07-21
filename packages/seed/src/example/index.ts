import { seedUsers } from '../required/users.seed.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { seedAccommodations } from './accommodations.seed.js';
// import { seedUsers } from './users.seed.js';

export async function runExampleSeeds(context: SeedContext) {
    logger.info('🌱 Inicializando carga de datos de ejemplo...\n');

    await seedUsers(context);
    await seedAccommodations(context);

    logger.success('✅ Finalizada carga de datos de ejemplo.');
    summaryTracker.print();
}
