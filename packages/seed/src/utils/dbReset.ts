import { getDb, schema } from '@repo/db';
import type { Table } from 'drizzle-orm';
import { STATUS_ICONS } from './icons.js';
import { IdMapper } from './idMapper.js';
import { logger } from './logger.js';

// Define all tables in the correct order (children before parents)
const allTables: Table[] = [
    // Relationship tables (children)
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

    // Review tables (children)
    schema.accommodationReviews,
    schema.destinationReviews,

    // Sponsorship tables (children before parents)
    schema.sponsorships,
    schema.sponsorshipPackages,
    schema.sponsorshipLevels,

    // Main tables (parents)
    schema.accommodations,
    schema.attractions,
    schema.destinations,
    schema.posts,
    schema.events,
    schema.tags,
    schema.amenities,
    schema.features,
    schema.postSponsorships,

    // Better Auth tables (before users due to FK)
    schema.sessions,
    schema.accounts,
    schema.verifications,

    schema.users
];

// Table name mapping for logging
const tableNameMap = new Map<Table, string>([
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
    [schema.sponsorships, 'sponsorships'],
    [schema.sponsorshipPackages, 'sponsorship_packages'],
    [schema.sponsorshipLevels, 'sponsorship_levels'],
    [schema.accommodations, 'accommodations'],
    [schema.attractions, 'attractions'],
    [schema.destinations, 'destinations'],
    [schema.posts, 'posts'],
    [schema.events, 'events'],
    [schema.tags, 'tags'],
    [schema.amenities, 'amenities'],
    [schema.features, 'features'],
    [schema.postSponsorships, 'post_sponsorships'],
    [schema.sessions, 'session'],
    [schema.accounts, 'account'],
    [schema.verifications, 'verification'],
    [schema.users, 'users']
]);

/**
 * Resets the database by deleting all data from all tables in the correct order.
 *
 * This function ensures that tables are deleted from children to parents to
 * avoid foreign key constraint violations. It provides detailed logging of
 * the reset process and handles exclusions gracefully.
 *
 * The deletion order is:
 * 1. Relationship tables (many-to-many)
 * 2. Review tables (dependent on main entities)
 * 3. Main entity tables (accommodations, attractions, etc.)
 * 4. User table (last to avoid dependency issues)
 *
 * @param exclude - Array of table names to exclude from deletion
 * @returns Promise that resolves when the reset is complete
 *
 * @example
 * ```typescript
 * // Reset all tables
 * await resetDatabase();
 *
 * // Reset excluding users and accommodations
 * await resetDatabase(['users', 'accommodations']);
 * ```
 *
 * @throws {Error} When database operations fail
 */
export async function resetDatabase(exclude: string[] = []): Promise<void> {
    const separator = '#'.repeat(90);
    const subSeparator = '─'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Reset}  RESETTING DATABASE`);
    logger.info(`${subSeparator}`);

    const db = getDb();
    let deletedCount = 0;
    let skippedCount = 0;

    for (const table of allTables) {
        const tableName = tableNameMap.get(table);
        if (!tableName) {
            logger.warn(`${STATUS_ICONS.Warning} Table without mapping: ${table}`);
            continue;
        }

        if (exclude.includes(tableName)) {
            logger.info(`${STATUS_ICONS.Skip} Skipping table: ${tableName}`);
            skippedCount++;
            continue;
        }

        try {
            await db.delete(table);
            logger.info(`${STATUS_ICONS.Reset}  Deleted: ${tableName}`);
            deletedCount++;
        } catch (error) {
            logger.error(
                `${STATUS_ICONS.Error} Error deleting ${tableName}: ${(error as Error).message}`
            );
            throw error;
        }
    }

    // Clear ID mappings after successful reset
    const idMapper = new IdMapper(true);
    idMapper.clearAll();

    logger.info(`${subSeparator}`);
    logger.success({
        msg: `${STATUS_ICONS.Success} Database reset completed: ${deletedCount} tables deleted, ${skippedCount} skipped`
    });
    logger.info(`${separator}`);
}
