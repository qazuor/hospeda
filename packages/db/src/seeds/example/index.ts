import { dbLogger } from '../../utils/logger.js';
import { seedExampleAccommodations } from './accommodation';
import { seedAccommodationReviews } from './accommodation-review.example.seed.js';
import { seedDestinationReviews } from './destination-review.example.seed.js';
import { seedEvents } from './event.example.seed.js';
import { seedPosts } from './post.example.seed.js';
import { seedSponsors } from './sponsor.example.seed.js';
import { seedExampleUsers } from './user.example.seed.js';

/**
 * Seeds all example data in the correct order:
 * 1. Example Users
 * 2. Accommodations
 * 3. Accommodation Reviews
 * 4. Destination Reviews
 * 5. Sponsors
 * 6. Posts (some sponsored)
 * 7. Events
 */
export async function seedExampleData(): Promise<void> {
    dbLogger.info({ location: 'seedExampleData' }, 'Starting example data seeding process...');

    try {
        // Seed example users first
        dbLogger.info({ location: 'seedExampleData' }, 'Seeding example users...');
        await seedExampleUsers();
        dbLogger.info({ location: 'seedExampleData' }, 'Example users seeded successfully');

        // Seed accommodations
        dbLogger.info({ location: 'seedExampleData' }, 'Seeding accommodations...');
        await seedExampleAccommodations();
        dbLogger.info({ location: 'seedExampleData' }, 'Accommodations seeded successfully');

        // Seed accommodation reviews
        dbLogger.info({ location: 'seedExampleData' }, 'Seeding accommodation reviews...');
        await seedAccommodationReviews();
        dbLogger.info({ location: 'seedExampleData' }, 'Accommodation reviews seeded successfully');

        // Seed destination reviews
        dbLogger.info({ location: 'seedExampleData' }, 'Seeding destination reviews...');
        await seedDestinationReviews();
        dbLogger.info({ location: 'seedExampleData' }, 'Destination reviews seeded successfully');

        // Seed sponsors
        dbLogger.info({ location: 'seedExampleData' }, 'Seeding sponsors...');
        await seedSponsors();
        dbLogger.info({ location: 'seedExampleData' }, 'Sponsors seeded successfully');

        // Seed posts
        dbLogger.info({ location: 'seedExampleData' }, 'Seeding posts...');
        await seedPosts();
        dbLogger.info({ location: 'seedExampleData' }, 'Posts seeded successfully');

        // Seed events
        dbLogger.info({ location: 'seedExampleData' }, 'Seeding events...');
        await seedEvents();
        dbLogger.info({ location: 'seedExampleData' }, 'Events seeded successfully');

        dbLogger.info({ location: 'seedExampleData' }, 'All example data seeded successfully!');
    } catch (error) {
        dbLogger.error(error as Error, 'Error seeding example data in seedExampleData');
        throw error;
    }
}
