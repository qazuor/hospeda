import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    ExperienceService,
    GastronomyService
} from '@repo/service-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { purgeInactiveListing } from '../../../../../packages/verticals/src/publication/purge-inactive-listing';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { apiLogger } from '../../../src/utils/logger';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createOwner,
    createVerticalDestination,
    createVerticalListing
} from './publication-routes.helpers';

const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.GASTRONOMY,
    VerticalEnum.EXPERIENCE
] as const;
type Vertical = (typeof verticals)[number];
const tables: Readonly<Record<Vertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.GASTRONOMY]: 'gastronomies',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};
const MATRIX_NOW = new Date('2026-10-10T12:00:00.000Z');
const DAY = 86_400_000;
const fixtureIds: { ownerId: string; destinationId: string; listingId: string }[] = [];

function ownerActor(ownerId: string): Actor {
    return {
        id: ownerId,
        roles: [RoleEnum.HOST, RoleEnum.GASTRONOMY_OWNER, RoleEnum.EXPERIENCE_OWNER],
        permissions: [
            PermissionEnum.ACCOMMODATION_UPDATE_OWN,
            PermissionEnum.GASTRONOMY_EDIT_OWN,
            PermissionEnum.EXPERIENCE_EDIT_OWN
        ]
    };
}

async function editService(vertical: Vertical) {
    if (vertical === VerticalEnum.ACCOMMODATION)
        return new AccommodationService({ logger: apiLogger });
    if (vertical === VerticalEnum.GASTRONOMY) return new GastronomyService({ logger: apiLogger });
    return new ExperienceService({ logger: apiLogger });
}

async function cleanupFixture(args: { ownerId: string; destinationId: string; listingId: string }) {
    await getDb().execute(
        sql`DELETE FROM email_outbox WHERE recipient_user_id = ${args.ownerId}::uuid`
    );
    for (const vertical of verticals) {
        await getDb().execute(
            sql`DELETE FROM ${sql.identifier(tables[vertical])} WHERE id = ${args.listingId}::uuid`
        );
    }
    await getDb().execute(sql`DELETE FROM destinations WHERE id = ${args.destinationId}::uuid`);
    await getDb().execute(sql`DELETE FROM users WHERE id = ${args.ownerId}::uuid`);
}

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => MATRIX_NOW } });
});
afterEach(async () => {
    for (const fixture of fixtureIds.splice(0)) await cleanupFixture(fixture);
});
afterAll(async () => testDb.teardown());

describe.each(
    verticals
)('TEST:V9b:2 AC:V9b:2 — ningún evento conserva el texto — %s', (vertical) => {
    it('TEST:V9b:2 — purga tras ediciones reales del dueño y borra el texto de todos sus eventos', async () => {
        const owner = await createOwner();
        const destinationId = await createVerticalDestination();
        const listingId =
            vertical === VerticalEnum.ACCOMMODATION
                ? await createListing({
                      ownerId: owner.id,
                      destinationId,
                      status: PublicationStatusEnum.DRAFT,
                      complete: false
                  })
                : await createVerticalListing({
                      vertical,
                      ownerId: owner.id,
                      destinationId,
                      status: PublicationStatusEnum.DRAFT
                  });
        const fixture = { ownerId: owner.id, destinationId, listingId };
        fixtureIds.push(fixture);
        const texts = [1, 2, 3].map((n) => `Texto ${n} V9b2 ${randomUUID()}`);
        const summaryText = `Resumen V9b2 ${randomUUID()}`;
        const service = await editService(vertical);
        const actor = ownerActor(owner.id);

        for (const description of texts) {
            const result = await service.update(actor, listingId, { description });
            expect(result.error).toBeUndefined();
        }
        const summaryResult = await service.update(actor, listingId, { summary: summaryText });
        expect(summaryResult.error).toBeUndefined();

        const ownerEvents = await getDb().execute(sql`
            SELECT * FROM domain_event
            WHERE entity_id = ${listingId}
              AND event_type = 'listing.edited'
              AND actor_type = 'owner'
        `);
        expect(ownerEvents.rows.length).toBeGreaterThanOrEqual(4);

        await getDb().execute(
            sql`UPDATE ${sql.identifier(tables[vertical])}
                SET publication_status = 'ARCHIVED', inactive_since = ${new Date(MATRIX_NOW.getTime() - 200 * DAY)},
                    deadlines_version = 1, deletion_announced_at = ${new Date(MATRIX_NOW.getTime() - DAY)}
                WHERE id = ${listingId}::uuid`
        );

        const result = await purgeInactiveListing({
            ...getListingPublicationPorts(),
            billing: {
                coverage: async () => ({ covered: false, sources: [] }),
                retentionStopped: async () => ({
                    stopped: false,
                    pauseEndedAt: null,
                    coverageLostAt: null
                })
            },
            vertical,
            listingId,
            ownerId: owner.id,
            correlationId: randomUUID()
        });
        expect(result.purged).toBe(true);

        const events = await getDb().execute(
            sql`SELECT * FROM domain_event WHERE entity_id = ${listingId}`
        );
        const serializedEvents = JSON.stringify(events.rows);
        for (const text of [...texts, summaryText]) expect(serializedEvents).not.toContain(text);

        const listingRows = await getDb().execute(
            sql`SELECT publication_status, description FROM ${sql.identifier(tables[vertical])}
                WHERE id = ${listingId}::uuid`
        );
        expect(listingRows.rows[0]?.publication_status).toBe(PublicationStatusEnum.PURGED);
        const blankDescription = listingRows.rows[0]?.description;
        expect(blankDescription).toBe('');
        for (const text of [...texts, summaryText]) expect(blankDescription).not.toContain(text);

        const purgeEvents = events.rows.filter(
            (event) => event.event_type === 'listing.status_changed' && event.actor_type === 'job'
        );
        expect(purgeEvents).toHaveLength(1);
        expect(purgeEvents[0]?.changes).toEqual([
            { field: 'publicationStatus', old: 'ARCHIVED', new: 'PURGED' }
        ]);
    });
});
