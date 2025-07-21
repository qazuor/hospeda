import { configureLogger } from '@repo/logger';
import { runExampleSeeds } from './example/index.js';
import { runRequiredSeeds } from './required/index.js';
import { closeSeedDb, initSeedDb } from './utils/db.js';
import { resetDatabase } from './utils/dbReset';
import { logger } from './utils/logger.js';
import { createSeedContext } from './utils/seedContext.js';
import { summaryTracker } from './utils/summaryTracker.js';
import { validateAllManifests } from './utils/validateAllManifests.js';
// import { runMigrations } from './utils/migrateRunner.js';

type SeedOptions = {
    required?: boolean;
    example?: boolean;
    reset?: boolean;
    migrate?: boolean;
    rollbackOnError?: boolean;
    continueOnError?: boolean;
    exclude?: string[]; // 👈 nueva opción
};

export async function runSeed(options: SeedOptions) {
    const { required, example, reset, migrate, exclude = [], continueOnError = false } = options;

    // Configurar logger para mostrar logs completos durante el seed
    configureLogger({
        TRUNCATE_LONG_TEXT: false,
        EXPAND_OBJECT_LEVELS: 3
    });

    // Inicializar la base de datos
    initSeedDb();

    // Crear el contexto de seed
    const seedContext = createSeedContext({
        continueOnError,
        resetDatabase: reset || false,
        runMigrations: migrate || false,
        exclude
    });

    logger.info('🚀 Iniciando proceso de seed...');

    try {
        if (reset) {
            logger.info(
                `🧹 Ejecutando reset${exclude.length > 0 ? ` (excluyendo: ${exclude.join(', ')})` : ''}`
            );
            try {
                await resetDatabase(exclude);
                summaryTracker.trackProcessStep(
                    'Reset DB',
                    'success',
                    'Base de datos reseteada correctamente'
                );
            } catch (error) {
                summaryTracker.trackProcessStep(
                    'Reset DB',
                    'error',
                    'Error al resetear base de datos',
                    (error as Error).message
                );
                throw error;
            }
        }

        if (migrate) {
            // TODO: Implement migration runner
            // await runMigrations();
            logger.warn('⚠️ Migration runner not implemented yet');
            summaryTracker.trackProcessStep(
                'Migrations',
                'warning',
                'Migration runner no implementado'
            );
        }

        // Validar todos los manifests una sola vez al inicio
        if ((required || example) && seedContext.validateManifests) {
            try {
                await validateAllManifests(continueOnError);
                summaryTracker.trackProcessStep(
                    'Validación Manifests',
                    'success',
                    'Todos los manifests validados correctamente'
                );
            } catch (error) {
                summaryTracker.trackProcessStep(
                    'Validación Manifests',
                    'error',
                    'Error en validación de manifests',
                    (error as Error).message
                );
                if (!continueOnError) {
                    throw error;
                }
            }
        }

        if (required) {
            await runRequiredSeeds(seedContext);
        }

        if (example) {
            await runExampleSeeds(seedContext);
        }

        logger.success('🎉 Proceso de seed completo.');
        summaryTracker.trackProcessStep(
            'Proceso Completo',
            'success',
            'Seed completado exitosamente'
        );
    } catch (error) {
        summaryTracker.trackProcessStep(
            'Proceso Completo',
            'error',
            'Seed interrumpido por error',
            (error as Error).message
        );

        // Mostrar el summary ANTES del throw final
        summaryTracker.print();

        // Ahora lanzar el error
        throw error;
    } finally {
        // Siempre cerrar la conexión
        await closeSeedDb();
    }
}
