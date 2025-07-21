import { getDb, schema } from '@repo/db';
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

// Tablas que no se deben borrar (protegidas)
const protectedTableNames = new Set(['role_permission', 'user_permission']);

export async function resetDatabase(exclude: string[] = []) {
    logger.warn('⚠️ Reseteando base de datos...');

    const excludeSet = new Set([...protectedTableNames, ...exclude]);
    const db = getDb();

    for (const table of allTables) {
        // Obtener el nombre de la tabla desde el mapeo
        const tableName = tableNameMap.get(table);

        if (!tableName) {
            logger.error(`❌ Nombre de tabla no encontrado para: ${table}`);
            continue;
        }

        if (excludeSet.has(tableName)) {
            logger.dim(`↪️  Skipping table: ${tableName}`);
            continue;
        }

        try {
            await db.delete(table);
            logger.info(`🧹 Borrado: ${tableName}`);
        } catch (error) {
            logger.error(`❌ Error borrando tabla ${tableName}: ${(error as Error).message}`);
        }
    }

    logger.success('✅ Base de datos reseteada');
}
