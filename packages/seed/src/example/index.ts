import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { seedAccommodationReviews } from './accommodationReviews.seed.js';
import { seedAccommodations } from './accommodations.seed.js';
import { seedBookmarks } from './bookmarks.seed.js';
import { seedDestinationReviews } from './destinationReviews.seed.js';
import { seedEventLocations } from './eventLocations.seed.js';
import { seedEventOrganizers } from './eventOrganizers.seed.js';
import { seedEvents } from './events.seed.js';
import { seedPostSponsors } from './postSponsors.seed.js';
import { seedPostSponsorships } from './postSponsorships.seed.js';
import { seedPosts } from './posts.seed.js';
import { seedTagRelations } from './tagRelations.seed.js';
import { seedTags } from './tags.seed.js';
import { seedUsers } from './users.seed.js';

/**
 * Executes all example seeds in the correct order.
 *
 * Example seeds contain sample data that demonstrates the application's
 * functionality and provides realistic test data. This includes:
 * - Users (additional to required users)
 * - Accommodations with amenities and features
 * - Events with organizers and locations
 * - Posts with sponsors and sponsorships
 * - Reviews for accommodations and destinations
 * - Bookmarks and tags
 *
 * The seeds are executed in a specific order to ensure that:
 * - Dependencies are available before they're needed
 * - Actor context is properly managed for different entity types
 * - ID mappings are established for relationship building
 * - Tag relations are created after all entities exist
 *
 * @param context - Seed context with configuration and utilities
 * @returns Promise that resolves when all example seeds are complete
 *
 * @example
 * ```typescript
 * await runExampleSeeds(seedContext);
 * // Executes in order:
 * // 1. Users
 * // 2. Accommodations (with amenities/features)
 * // 3. Event organizers and locations
 * // 4. Events
 * // 5. Posts (with sponsors/sponsorships)
 * // 6. Reviews
 * // 7. Bookmarks and tags
 * // 8. Tag relations (connecting tags to entities)
 * ```
 *
 * @throws {Error} When seeding fails and continueOnError is false
 */
export async function runExampleSeeds(context: SeedContext): Promise<void> {
    logger.info(`${STATUS_ICONS.Seed} Initializing example data load...\n`);

    try {
        // Accommodations modified the actor to set the owner id as actor,
        // so we save the old actor and restore it after the seed
        const oldContextActor = context.actor;

        await seedUsers(context);
        await seedAccommodations(context);
        context.actor = oldContextActor;
        await seedEventOrganizers(context);
        await seedEventLocations(context);
        await seedEvents(context);
        context.actor = oldContextActor;
        await seedPosts(context);
        context.actor = oldContextActor;
        await seedPostSponsors(context);
        await seedPostSponsorships(context);
        await seedDestinationReviews(context);
        await seedAccommodationReviews(context);
        await seedBookmarks(context);
        context.actor = oldContextActor;
        await seedTags(context);
        await seedTagRelations(context);

        logger.success(`${STATUS_ICONS.Success} Example data load completed.`);
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error} Example data load interrupted`);
        logger.error(`   Error: ${(error as Error).message}`);

        // If we shouldn't continue on error, re-throw the exception
        if (!context.continueOnError) {
            throw error;
        }
    } finally {
        // Always show summary, regardless of errors
        summaryTracker.print();
    }
}
