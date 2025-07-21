import { logger } from './logger.ts';
import type { SeedContext } from './seedContext.js';

type SeedRunnerOptions<T> = {
    entityName: string;
    items: T[];
    process: (item: T, index: number) => Promise<void>;
    onError?: (item: T, index: number, error: Error) => void;
    context: SeedContext;
    getEntityInfo?: (item: T) => string;
};

// Iconos por tipo de entidad
const entityIcons: Record<string, string> = {
    Users: '👤',
    Destinations: '🗺️',
    Amenities: '🏠',
    Features: '⭐',
    Accommodations: '🏨',
    Tags: '🏷️',
    Posts: '📝',
    Events: '🎉',
    Attractions: '🎯',
    Reviews: '⭐',
    Bookmarks: '🔖',
    Sponsors: '💼',
    Organizers: '👥',
    Locations: '📍'
};

// Separador visual
const separator = '─'.repeat(60);

export async function seedRunner<T>({
    entityName,
    items,
    process,
    onError,
    context,
    getEntityInfo
}: SeedRunnerOptions<T>): Promise<void> {
    const icon = entityIcons[entityName] || '📦';

    // Separador antes de cada tipo de entidad
    logger.info(`\n${separator}`);
    logger.info(`${icon} Inicializando carga de ${entityName} (${items.length} ítems)...`);
    logger.info(`${separator}`);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        try {
            if (item !== undefined) {
                await process(item, i);

                // Información de la entidad cargada
                const entityInfo = getEntityInfo ? getEntityInfo(item) : '';
                const successMessage = entityInfo
                    ? `   ${icon} ${entityName} cargado [${i + 1}/${items.length}]: ${entityInfo}`
                    : `   ${icon} ${entityName} cargado [${i + 1}/${items.length}]`;

                logger.success(successMessage);
            }
        } catch (err) {
            const error = err as Error;

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

    logger.info(`✅ Finalizada carga de ${entityName}\n`);
}
