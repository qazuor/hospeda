import { getDb, schema } from '@repo/db';
import { STATUS_ICONS } from './icons.js';
import { IdMapper } from './idMapper.js';
import { logger } from './logger.js';

// Definir todas las tablas en el orden correcto (hijos antes que padres)
const allTables = [
    // Tablas de relaciones (hijos)
    schema.rDestinationAttraction,
    schema.rEntityTag,
    schema.rAccommodationAmenity,
    schema.rAccommodationFeature,
    schema.postSponsors,
    schema.eventLocations,
    schema.eventOrganizers,
    schema.userBookmarks,
    schema.userPermission,
    schema.rolePermission,

    // Tablas de reviews (hijos)
    schema.accommodationReviews,
    schema.destinationReviews,

    // Tablas principales (padres)
    schema.accommodations,
    schema.attractions,
    schema.destinations,
    schema.posts,
    schema.events,
    schema.tags,
    schema.amenities,
    schema.features,
    schema.postSponsorships,
    schema.users
];

// Mapeo de tablas a nombres para logging
const tableNameMap = new Map([
    [schema.rDestinationAttraction, 'r_destination_attraction'],
    [schema.rEntityTag, 'r_entity_tag'],
    [schema.rAccommodationAmenity, 'r_accommodation_amenity'],
    [schema.rAccommodationFeature, 'r_accommodation_feature'],
    [schema.postSponsors, 'post_sponsors'],
    [schema.eventLocations, 'event_locations'],
    [schema.eventOrganizers, 'event_organizers'],
    [schema.userBookmarks, 'user_bookmarks'],
    [schema.userPermission, 'user_permission'],
    [schema.rolePermission, 'role_permission'],
    [schema.accommodationReviews, 'accommodation_reviews'],
    [schema.destinationReviews, 'destination_reviews'],
    [schema.accommodations, 'accommodations'],
    [schema.attractions, 'attractions'],
    [schema.destinations, 'destinations'],
    [schema.posts, 'posts'],
    [schema.events, 'events'],
    [schema.tags, 'tags'],
    [schema.amenities, 'amenities'],
    [schema.features, 'features'],
    [schema.postSponsorships, 'post_sponsorships'],
    [schema.users, 'users']
]);

/**
 * Resets the database by deleting all data from all tables in the correct order.
 * Tables are deleted from children to parents to avoid foreign key constraint violations.
 * @param exclude - Array of table names to exclude from deletion
 */
export async function resetDatabase(exclude: string[] = []): Promise<void> {
    const separator = '#'.repeat(90);
    const subSeparator = '─'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Reset} RESETEANDO BASE DE DATOS`);
    logger.info(`${subSeparator}`);

    const db = getDb();
    let deletedCount = 0;
    let skippedCount = 0;

    for (const table of allTables) {
        const tableName = tableNameMap.get(table);
        if (!tableName) {
            logger.warn(`${STATUS_ICONS.Warning} Tabla sin mapeo: ${table}`);
            continue;
        }

        if (exclude.includes(tableName)) {
            logger.info(`${STATUS_ICONS.Skip} Saltando tabla: ${tableName}`);
            skippedCount++;
            continue;
        }

        try {
            await db.delete(table);
            logger.info(`${STATUS_ICONS.Reset} Borrado: ${tableName}`);
            deletedCount++;
        } catch (error) {
            logger.error(
                `${STATUS_ICONS.Error} Error al borrar ${tableName}: ${(error as Error).message}`
            );
        }
    }

    const idMapper = new IdMapper();
    idMapper.clearAll();

    logger.info(`${subSeparator}`);
    logger.success(`${STATUS_ICONS.Success} Base de datos reseteada`);
    logger.info(`${STATUS_ICONS.Info} Tablas borradas: ${deletedCount}, Saltadas: ${skippedCount}`);
    logger.info(`${separator}`);
}
