import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { loadSuperAdminAndGetActor } from '../utils/superAdminLoader.js';
import { seedAmenities } from './amenities.seed.js';
import { seedAttractions } from './attractions.seed.js';
import { seedDestinations } from './destinations.seed.js';
import { seedFeatures } from './features.seed.js';
import { seedUsers } from './users.seed.js';

export async function runRequiredSeeds(context: SeedContext) {
    const separator = '#'.repeat(90);

    logger.info(`${separator}`);
    logger.info('🌱  INICIALIZANDO CARGA DE DATOS REQUERIDOS');

    try {
        // 1. Primero cargar el super admin y obtener su ID real
        const superAdminActor = await loadSuperAdminAndGetActor();

        // 2. Actualizar el contexto con el actor real
        context.actor = superAdminActor;

        // 3. Cargar el resto de usuarios (excluyendo super admin)
        await seedUsers(context);

        // 4. Cargar amenities (antes que attractions para tener el mapeo de IDs)
        await seedAmenities(context);

        // 5. Cargar features (antes que attractions para tener el mapeo de IDs)
        await seedFeatures(context);

        // 6. Cargar attractions (antes que destinations para tener el mapeo de IDs)
        await seedAttractions(context);

        // 7. Cargar destinos (usa el mapeo de IDs para relaciones)
        await seedDestinations(context);

        logger.info(`${separator}`);
        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
        console.log('\n\n');
        logger.success('✅  CARGA DE DATOS REQUERIDOS COMPLETADA');
    } catch (error) {
        logger.info(`${separator}`);
        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
        console.log('\n\n');
        logger.error('❌  CARGA DE DATOS REQUERIDOS INTERRUMPIDA');
        logger.error(`   Error: ${(error as Error).message}`);

        // Si no se debe continuar en error, relanzar la excepción
        if (!context.continueOnError) {
            throw error;
        }
    } finally {
        // Siempre mostrar el summary, sin importar si hubo errores
        summaryTracker.print();
    }
}
