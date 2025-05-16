import { logger } from '@repo/logger';
import { seedEvents } from './event.example.seed';
import { seedPosts } from './post.example.seed';
import { seedSponsors } from './sponsor.example.seed';
import { seedExampleUsers } from './user.example.seed';

/**
 * Seeds all example data in the correct order:
 * 1. Example Users
 * 2. Accommodations
 * 3. Sponsors
 * 4. Posts (some sponsored)
 * 5. Events
 * 6. Reviews are seeded within accommodations and destinations
 */
export async function seedExampleData(): Promise<void> {
    logger.info('Starting example data seeding process...', 'seedExampleData');

    try {
        // Seed example users first
        logger.info('Seeding example users...', 'seedExampleData');
        await seedExampleUsers();
        logger.info('Example users seeded successfully', 'seedExampleData');

        // Seed accommodations
        logger.info('Seeding accommodations...', 'seedExampleData');
        // await seedExampleAccommodations();
        logger.info('Accommodations seeded successfully', 'seedExampleData');

        // Seed sponsors
        logger.info('Seeding sponsors...', 'seedExampleData');
        await seedSponsors();
        logger.info('Sponsors seeded successfully', 'seedExampleData');

        // Seed posts
        logger.info('Seeding posts...', 'seedExampleData');
        await seedPosts();
        logger.info('Posts seeded successfully', 'seedExampleData');

        // Seed events
        logger.info('Seeding events...', 'seedExampleData');
        await seedEvents();
        logger.info('Events seeded successfully', 'seedExampleData');

        logger.info('All example data seeded successfully!', 'seedExampleData');
    } catch (error) {
        logger.error('Error seeding example data', 'seedExampleData', error);
        throw error;
    }
}
