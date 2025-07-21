import { configureLogger } from '@repo/logger';
import { runExampleSeeds } from './example/index.js';
import { runRequiredSeeds } from './required/index.js';
import { closeSeedDb, initSeedDb } from './utils/db.js';
import { resetDatabase } from './utils/dbReset';
import { logger } from './utils/logger.js';
import { createSeedContext } from './utils/seedContext.js';
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
            await resetDatabase(exclude);
        }

        if (migrate) {
            // TODO: Implement migration runner
            // await runMigrations();
            logger.warn('⚠️ Migration runner not implemented yet');
        }

        // Validar todos los manifests una sola vez al inicio
        if ((required || example) && seedContext.validateManifests) {
            await validateAllManifests(continueOnError);
        }

        if (required) {
            await runRequiredSeeds(seedContext);
        }

        if (example) {
            await runExampleSeeds(seedContext);
        }

        logger.success('🎉 Proceso de seed completo.');
    } finally {
        // Cerrar la conexión de base de datos
        await closeSeedDb();
    }
}
