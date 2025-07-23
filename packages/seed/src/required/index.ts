import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { seedAmenities } from './amenities.seed.js';
import { seedAttractions } from './attractions.seed.js';
import { seedDestinations } from './destinations.seed.js';
import { seedFeatures } from './features.seed.js';
import { seedUsers } from './users.seed.js';

export async function runRequiredSeeds(context: SeedContext) {
    const separator = '#'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  INICIALIZANDO CARGA DE DATOS REQUERIDOS`);

    try {
        // TODO: Add seed for role permissions
        // TODO: Add seed for user permissions

        // El super admin ya fue cargado en el contexto principal
        // 1. Cargar el resto de usuarios (excluyendo super admin)
        await seedUsers(context);

        // 2. Cargar amenities (antes que attractions para tener el mapeo de IDs)
        await seedAmenities(context);

        // 3. Cargar features (antes que attractions para tener el mapeo de IDs)
        await seedFeatures(context);

        // 4. Cargar attractions (antes que destinations para tener el mapeo de IDs)
        await seedAttractions(context);

        // 5. Cargar destinos (usa el mapeo de IDs para relaciones)
        await seedDestinations(context);

        logger.info(`${separator}`);
        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
        console.log('\n\n');
        logger.success(`${STATUS_ICONS.Success}  CARGA DE DATOS REQUERIDOS COMPLETADA`);
    } catch (error) {
        logger.info(`${separator}`);
        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
        console.log('\n\n');
        logger.error(`${STATUS_ICONS.Error}  CARGA DE DATOS REQUERIDOS INTERRUMPIDA`);
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
