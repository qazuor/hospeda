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
import { seedTags } from './tags.seed.js';
import { seedUsers } from './users.seed.js';

export async function runExampleSeeds(context: SeedContext) {
    logger.info(`${STATUS_ICONS.Seed} Inicializando carga de datos de ejemplo...\n`);

    try {
        // Accommodations modified the actore, to set the owner id as actor,
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

        // TODO: Add seed for destination <-> attraction relationships
        // TODO: Add seed for accommodation faqs
        // TODO: Add seed for accommodation ia data
        // TODO: Add seed for accommodation <-> amenity relationships
        // TODO: Add seed for accommodation <-> feature relationships
        // TODO: Add seed for tag <-> entity relationships

        logger.success(`${STATUS_ICONS.Success} Finalizada carga de datos de ejemplo.`);
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error} Carga de datos de ejemplo interrumpida`);
        logger.error(`   Error: ${(error as Error).message}`);

        // Si no se debe continuar en error, relanzar la excepción
        if (!context.continueOnError) {
            throw error;
        }
    } finally {
        // Siempre mostrar el summary, sin importar si hubo errores
        summaryTracker.print();
    }
}
