import { logger } from './logger.js';
import type { SeedContext } from './seedContext.js';

export interface SeedRunnerOptions<T> {
    entityName: string;
    items: T[];
    process: (item: T, index: number) => Promise<void>;
    onError?: (item: T, index: number, error: Error) => void;
    context: SeedContext;
    getEntityInfo?: (item: T) => string;
}

// Iconos por tipo de entidad
const entityIcons: Record<string, string> = {
    Users: '👨‍💻',
    Destinations: '🌍',
    Amenities: '✨',
    Features: '💎',
    Accommodations: '🏠',
    Tags: '🏷️',
    Posts: '📝',
    Events: '🎉',
    Attractions: '🎯',
    Reviews: '⭐',
    Bookmarks: '🔖',
    Sponsors: '💼',
    Organizers: '👨‍💼',
    Locations: '📍'
};

// Separadores visuales consistentes
const SECTION_SEPARATOR = '#'.repeat(90);
const SUBSECTION_SEPARATOR = '─'.repeat(90);

export async function seedRunner<T>({
    entityName,
    items,
    process,
    onError,
    context,
    getEntityInfo
}: SeedRunnerOptions<T>): Promise<void> {
    const icon = entityIcons[entityName] || '📦';
    const totalItems = items.length;
    let successCount = 0;
    let errorCount = 0;

    // Separador de sección principal
    logger.info(`${SECTION_SEPARATOR}`);
    logger.info(`${icon}  INICIALIZANDO CARGA DE ${entityName.toUpperCase()}`);
    logger.info(`${icon}  Total de ítems: ${totalItems}`);
    logger.info(`${SUBSECTION_SEPARATOR}`);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const currentIndex = i + 1;

        try {
            if (item !== undefined) {
                await process(item, i);

                // Información de la entidad cargada
                const entityInfo = getEntityInfo ? getEntityInfo(item) : '';
                const successMessage = entityInfo
                    ? `${icon} ${entityInfo}`
                    : `${icon} ${entityName} #${currentIndex}`;

                logger.success(successMessage);
                successCount++;
            }
        } catch (err) {
            const error = err as Error;
            errorCount++;

            // Información del error
            const entityInfo =
                getEntityInfo && item ? getEntityInfo(item) : `${entityName} #${currentIndex}`;
            logger.error(`   ❌ Error en ${entityInfo}: ${error.message}`);

            // Call error handler first if available
            if (item !== undefined && onError) {
                onError(item, i, error);
            }

            // Si no se debe continuar en error, lanzar la excepción para parar el proceso
            if (!context.continueOnError) {
                throw err;
            }
        }
    }

    // Separador de finalización
    logger.info(`${SUBSECTION_SEPARATOR}`);

    if (errorCount === 0) {
        logger.success(`✅ ${entityName}: ${successCount} ítems procesados exitosamente`);
    } else {
        logger.warn(`⚠️  ${entityName}: ${successCount} exitosos, ${errorCount} errores`);
    }

    logger.info(`${SECTION_SEPARATOR}`);
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log('\n');
}
