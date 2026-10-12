import type { Accommodation, Experience, Gastronomy } from '@repo/schemas';
import { PublicationStatusEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { domainEventModel } from '../../src/models/domain-event/domain-event.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import { GastronomyModel } from '../../src/models/gastronomy/gastronomy.model.ts';
import { listingModerationModel } from '../../src/models/listing/listing-moderation.model.ts';
import {
    type ListingVertical,
    listingPublicationModel
} from '../../src/models/listing/listing-publication.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

async function createListing(
    tx: DrizzleClient,
    vertical: ListingVertical,
    ownerId: string,
    destinationId: string
) {
    const base = {
        name: 'Moderation test',
        slug: `moderation-${crypto.randomUUID()}`,
        summary: 'Summary',
        description: 'Description',
        ownerId,
        destinationId,
        publicationStatus: PublicationStatusEnum.DRAFT
    };
    if (vertical === 'accommodation')
        return new AccommodationModel().create(
            { ...base, type: 'CABIN' } as Partial<Accommodation>,
            tx
        );
    if (vertical === 'gastronomy')
        return new GastronomyModel().create(
            { ...base, type: 'RESTAURANT' } as Partial<Gastronomy>,
            tx
        );
    return new ExperienceModel().create({ ...base, type: 'EXCURSION' } as Partial<Experience>, tx);
}

describe('TEST:V6:11 listing moderation model', () => {
    it('reads only the latest MODERATED origin and its archive origin', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const admin = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values([owner, admin]);
            await tx.insert(destinations).values(destination);
            const listing = await createListing(tx, 'accommodation', owner.id, destination.id);
            const otherListing = await createListing(tx, 'accommodation', owner.id, destination.id);
            const firstAt = new Date('2026-01-01T00:00:00Z');
            const secondAt = new Date('2026-01-02T00:00:00Z');
            for (const event of [
                { from: PublicationStatusEnum.PUBLISHED, at: firstAt },
                { from: PublicationStatusEnum.ARCHIVED, at: secondAt }
            ]) {
                await listingPublicationModel.insertStatusChangedEvent({
                    tx,
                    vertical: 'accommodation',
                    listingId: listing.id,
                    from: event.from,
                    to: PublicationStatusEnum.MODERATED,
                    actorType: 'admin',
                    actorId: admin.id,
                    reason: 'policy',
                    archiveOrigin: PublicationStatusEnum.PUBLISHED,
                    correlationId: crypto.randomUUID(),
                    occurredAt: event.at
                });
            }
            await domainEventModel.insert({
                tx,
                eventType: 'listing.status_changed',
                entityType: 'accommodation',
                entityId: otherListing.id,
                actorType: 'admin',
                actorId: admin.id,
                correlationId: crypto.randomUUID(),
                occurredAt: new Date('2026-01-03T00:00:00Z'),
                changes: [{ field: 'publicationStatus', old: 'DRAFT', new: 'MODERATED' }]
            });
            await domainEventModel.insert({
                tx,
                eventType: 'listing.status_changed',
                entityType: 'gastronomy',
                entityId: listing.id,
                actorType: 'admin',
                actorId: admin.id,
                correlationId: crypto.randomUUID(),
                occurredAt: new Date('2026-01-04T00:00:00Z'),
                changes: [{ field: 'publicationStatus', old: 'DRAFT', new: 'MODERATED' }]
            });
            expect(
                await listingModerationModel.readModerationOrigin({
                    tx,
                    vertical: 'accommodation',
                    listingId: listing.id
                })
            ).toEqual({
                from: PublicationStatusEnum.ARCHIVED,
                archiveOrigin: PublicationStatusEnum.PUBLISHED
            });
            expect(
                await listingModerationModel.readModerationOrigin({
                    tx,
                    vertical: 'experience',
                    listingId: listing.id
                })
            ).toBeNull();
            expect(
                await listingModerationModel.readModerationOrigin({
                    tx,
                    vertical: 'accommodation',
                    listingId: crypto.randomUUID()
                })
            ).toBeNull();
        });
    });

    it('opens once, closes only the open request, then allows another request and a purge close', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const admin = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values([owner, admin]);
            await tx.insert(destinations).values(destination);
            const listing = await createListing(tx, 'accommodation', owner.id, destination.id);
            const args = {
                tx,
                vertical: 'accommodation' as const,
                listingId: listing.id,
                reason: 'repair',
                suggestedDate: null,
                openedById: admin.id,
                openedAt: new Date()
            };
            const first = await listingModerationModel.openFixRequest(args);
            expect(first.opened).toBe(true);
            if (!first.opened) throw new Error('first request unexpectedly conflicted');
            expect(await listingModerationModel.openFixRequest(args)).toEqual({
                opened: false,
                reason: 'ALREADY_OPEN'
            });
            const requestCount = await tx.execute(
                sql`SELECT count(*)::int AS count FROM fix_request WHERE entity_id = ${listing.id}::uuid`
            );
            expect(requestCount.rows[0]?.count).toBe(1);
            expect(
                await listingModerationModel.readOpenFixRequest({
                    tx,
                    vertical: 'accommodation',
                    listingId: listing.id
                })
            ).toMatchObject({ id: first.id, reason: 'repair' });
            expect(
                await listingModerationModel.closeOpenFixRequest({
                    tx,
                    vertical: 'accommodation',
                    listingId: listing.id,
                    closedAt: new Date(),
                    closedById: null
                })
            ).toEqual({ id: first.id });
            const second = await listingModerationModel.openFixRequest(args);
            expect(second.opened).toBe(true);
            if (!second.opened) throw new Error('closed request still conflicted');
            const firstClosed = await tx.execute(
                sql`SELECT closed_at, closed_by_id FROM fix_request WHERE id = ${first.id}::uuid`
            );
            expect(firstClosed.rows[0]?.closed_at).not.toBeNull();
            expect(firstClosed.rows[0]?.closed_by_id).toBeNull();
            await listingModerationModel.closeOpenFixRequest({
                tx,
                vertical: 'accommodation',
                listingId: listing.id,
                closedAt: new Date(),
                closedById: admin.id
            });
            const firstAfterSecondClose = await tx.execute(
                sql`SELECT closed_at, closed_by_id FROM fix_request WHERE id = ${first.id}::uuid`
            );
            expect(firstAfterSecondClose.rows[0]).toEqual(firstClosed.rows[0]);
        });
    });

    it('persists admin actor, reason, archive origin, and both fix request event types', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const admin = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values([owner, admin]);
            await tx.insert(destinations).values(destination);
            const listing = await createListing(tx, 'accommodation', owner.id, destination.id);
            await listingPublicationModel.insertStatusChangedEvent({
                tx,
                vertical: 'accommodation',
                listingId: listing.id,
                from: PublicationStatusEnum.ARCHIVED,
                to: PublicationStatusEnum.MODERATED,
                actorType: 'admin',
                actorId: admin.id,
                reason: 'reason',
                archiveOrigin: PublicationStatusEnum.DRAFT,
                correlationId: crypto.randomUUID()
            });
            const stored = await tx.execute(
                sql`SELECT actor_type, reason, changes FROM domain_event WHERE entity_id = ${listing.id} ORDER BY occurred_at DESC LIMIT 1`
            );
            expect(stored.rows[0]).toMatchObject({ actor_type: 'admin', reason: 'reason' });
            expect(stored.rows[0]?.changes).toContainEqual({
                field: 'archiveOrigin',
                new: 'DRAFT'
            });
            for (const eventType of [
                'listing.fix_request_opened',
                'listing.fix_request_closed'
            ] as const) {
                await listingModerationModel.insertFixRequestEvent({
                    tx,
                    vertical: 'accommodation',
                    listingId: listing.id,
                    eventType,
                    fixRequestId: crypto.randomUUID(),
                    actorType: 'admin',
                    actorId: admin.id,
                    reason: 'reason',
                    correlationId: crypto.randomUUID()
                });
            }
            const eventRows = await tx.execute(
                sql`SELECT event_type, reason FROM domain_event WHERE entity_id = ${listing.id}`
            );
            expect(eventRows.rows.map((row) => row.event_type).sort()).toEqual([
                'listing.fix_request_closed',
                'listing.fix_request_opened',
                'listing.status_changed'
            ]);
            expect(eventRows.rows.every((row) => row.reason === 'reason')).toBe(true);
        });
    });

    it('rejects an admin status event without actorId and an event type outside the catalog', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(owner);
            await tx.insert(destinations).values(destination);
            const listing = await createListing(tx, 'accommodation', owner.id, destination.id);
            await expect(
                listingPublicationModel.insertStatusChangedEvent({
                    tx,
                    vertical: 'accommodation',
                    listingId: listing.id,
                    from: PublicationStatusEnum.DRAFT,
                    to: PublicationStatusEnum.MODERATED,
                    actorType: 'admin',
                    correlationId: crypto.randomUUID()
                })
            ).rejects.toThrow();
        });
        await withTestTransaction(async (tx) => {
            await expect(
                tx.execute(
                    sql`INSERT INTO domain_event (event_type, entity_type, entity_id, actor_type, correlation_id) VALUES ('listing.not_in_catalog', 'accommodation', ${crypto.randomUUID()}, 'job', ${crypto.randomUUID()})`
                )
            ).rejects.toThrow();
        });
    });
});
