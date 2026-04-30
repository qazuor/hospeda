/**
 * Backfill script: populate events.destination_id from event_locations.destination_id.
 *
 * For each event with a NULL destination_id that has a linked location (via location_id),
 * this script copies the destination_id from the corresponding event_location row into
 * the event row.
 *
 * Usage:
 *   pnpm tsx packages/db/scripts/backfill-event-destinations.ts           # dry-run (default)
 *   pnpm tsx packages/db/scripts/backfill-event-destinations.ts --apply   # execute updates
 *
 * REQ-096-02 / SPEC-096 (T-004)
 */

import { createLogger } from '@repo/logger';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import 'dotenv/config';
import { Pool } from 'pg';
import { events } from '../src/schemas/event/event.dbschema.ts';
import { eventLocations } from '../src/schemas/event/event_location.dbschema.ts';
import * as schema from '../src/schemas/index.ts';

const logger = createLogger('backfill-event-destinations');

const DRY_RUN = !process.argv.includes('--apply');

if (DRY_RUN) {
    logger.info('Running in DRY-RUN mode. Pass --apply to execute updates.');
} else {
    logger.info('Running in APPLY mode. Updates will be committed to the database.');
}

async function main(): Promise<void> {
    const dbUrl = process.env.HOSPEDA_DATABASE_URL;
    if (!dbUrl) {
        logger.error('HOSPEDA_DATABASE_URL environment variable is not set');
        process.exit(1);
    }

    const pool = new Pool({ connectionString: dbUrl });
    const db = drizzle(pool, { schema });

    try {
        // Find events with NULL destination_id that have a location linked.
        // We join with event_locations to get the location's destination_id.
        const candidates = await db
            .select({
                eventId: events.id,
                eventSlug: events.slug,
                locationId: events.locationId,
                locationDestinationId: eventLocations.destinationId
            })
            .from(events)
            .innerJoin(
                eventLocations,
                and(
                    eq(events.locationId, eventLocations.id),
                    isNotNull(eventLocations.destinationId),
                    isNull(eventLocations.deletedAt)
                )
            )
            .where(and(isNull(events.destinationId), isNull(events.deletedAt)));

        logger.info({ count: candidates.length }, 'Events eligible for backfill');

        if (candidates.length === 0) {
            logger.info('No events require backfill. Exiting.');
            return;
        }

        let updated = 0;
        let skipped = 0;

        for (const row of candidates) {
            if (!row.locationDestinationId) {
                logger.warn(
                    { eventId: row.eventId, slug: row.eventSlug },
                    'Location has no destination_id — skipping'
                );
                skipped++;
                continue;
            }

            if (DRY_RUN) {
                logger.info(
                    {
                        eventId: row.eventId,
                        slug: row.eventSlug,
                        locationId: row.locationId,
                        destinationId: row.locationDestinationId
                    },
                    '[dry-run] Would set events.destination_id'
                );
                updated++;
                continue;
            }

            // Apply the update
            const result = await db
                .update(events)
                .set({
                    destinationId: row.locationDestinationId,
                    updatedAt: new Date()
                })
                .where(and(eq(events.id, row.eventId), isNull(events.destinationId)))
                .returning({ id: events.id });

            if (result.length > 0) {
                logger.info(
                    {
                        eventId: row.eventId,
                        slug: row.eventSlug,
                        destinationId: row.locationDestinationId
                    },
                    'Updated events.destination_id'
                );
                updated++;
            } else {
                logger.warn(
                    { eventId: row.eventId, slug: row.eventSlug },
                    'Update matched no rows (concurrent modification?) — skipping'
                );
                skipped++;
            }
        }

        logger.info(
            { updated, skipped, dryRun: DRY_RUN },
            DRY_RUN ? 'Dry-run complete' : 'Backfill complete'
        );
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    logger.error({ err }, 'Backfill script failed');
    process.exit(1);
});
