/**
 * Integration tests for `entity_interactions` (HOS-2256), against real Postgres.
 *
 * What a source or mocked test cannot see, asserted here:
 * - the `rollUpMonth` statement EXECUTES (a parse-time rejection is invisible
 *   behind a mocked model, the trap HOS-1063 fell into twice) and a re-run
 *   CORRECTS a month instead of duplicating it, including for rows whose
 *   `event_id` is NULL (the unique key is an expression for that reason);
 * - the CHECK that ties `event_id` to the two event kinds (AC-10 side);
 * - `ON DELETE SET NULL`: deleting an event keeps the row (AC-10);
 * - the purge deletes old rows and leaves new ones (AC-12);
 * - a rolled-up month survives the purge of its rows (AC-15).
 */
import { PublicationStatusEnum } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { EntityInteractionModel } from '../../src/models/entity-interaction/entity-interaction.model.ts';
import { entityInteractions } from '../../src/schemas/entity-interaction/entity_interaction.dbschema.ts';
import { destinations, users, venueEvents, venues } from '../../src/schemas/index.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

const model = new EntityInteractionModel();
const AUG_10 = new Date('2026-08-10T12:00:00.000Z');
const AUG_20 = new Date('2026-08-20T12:00:00.000Z');

/** Inserts an owner, a destination, a venue and one event; returns the venue and event ids. */
async function seedVenueWithEvent(tx: DrizzleClient) {
    const [owner] = await tx
        .insert(users)
        .values(testData.user({ role: 'HOST' }))
        .returning();
    if (!owner) throw new Error('owner');
    const [destination] = await tx
        .insert(destinations)
        .values(testData.destination({ ownerId: owner.id }))
        .returning();
    if (!destination) throw new Error('destination');
    const uid = crypto.randomUUID().slice(0, 8);
    const [venue] = await tx
        .insert(venues)
        .values({
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            inactiveSince: new Date(),
            deadlinesVersion: 1,
            ownerId: owner.id,
            destinationId: destination.id,
            slug: `hos2256-v-${uid}`,
            name: 'HOS-2256 venue',
            summary: 'summary of the fixture',
            type: 'RESTAURANT',
            businessLines: ['food'],
            description: 'description of the fixture'
        })
        .returning();
    if (!venue) throw new Error('venue');
    const [event] = await tx
        .insert(venueEvents)
        .values({
            venueId: venue.id,
            title: 'Noche de musica',
            recurrence: 'once',
            date: '2026-08-15',
            startTime: '21:00',
            displayOrder: 0
        })
        .returning();
    if (!event) throw new Error('event');
    return { venueId: venue.id, eventId: event.id };
}

async function readRollup(tx: DrizzleClient, entityId: string) {
    const res = await tx.execute(sql`
        SELECT kind::text AS kind, event_id::text AS event_id, month::text AS month, total, unique_visitors
        FROM entity_interaction_monthly_rollups
        WHERE entity_id = ${entityId}::uuid
        ORDER BY kind, event_id NULLS FIRST
    `);
    const rows = Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? []);
    return rows as Array<{
        kind: string;
        event_id: string | null;
        month: string;
        total: number;
        unique_visitors: number;
    }>;
}

describe('EntityInteractionModel (HOS-2256)', () => {
    it('inserts a row without touching entity_views (AC-14)', async () => {
        await withTestTransaction(async (tx) => {
            const entityId = crypto.randomUUID();

            const row = await model.insertInteraction(
                { entityType: 'VENUE', entityId, kind: 'PHONE_CLICK', visitorHash: 'v1' },
                tx
            );

            expect(row.eventId).toBeNull();
            const views = await tx.execute(
                sql`SELECT count(*)::int AS n FROM entity_views WHERE entity_id = ${entityId}::uuid`
            );
            const rows = Array.isArray(views)
                ? views
                : ((views as { rows?: unknown[] }).rows ?? []);
            expect((rows[0] as { n: number }).n).toBe(0);
        });
    });

    it('rejects an event_id on a kind that carries none (CHECK)', async () => {
        await withTestTransaction(async (tx) => {
            const { venueId, eventId } = await seedVenueWithEvent(tx);

            await expect(
                tx.transaction((inner) =>
                    model.insertInteraction(
                        {
                            entityType: 'VENUE',
                            entityId: venueId,
                            kind: 'PHONE_CLICK',
                            eventId,
                            visitorHash: 'v1'
                        },
                        inner as DrizzleClient
                    )
                )
            ).rejects.toThrow();
        });
    });

    it('keeps the row with event_id NULL when the event is deleted (AC-10)', async () => {
        await withTestTransaction(async (tx) => {
            const { venueId, eventId } = await seedVenueWithEvent(tx);
            const row = await model.insertInteraction(
                {
                    entityType: 'VENUE',
                    entityId: venueId,
                    kind: 'TICKET_CLICK',
                    eventId,
                    visitorHash: 'v1'
                },
                tx
            );
            expect(row.eventId).toBe(eventId);

            await tx.delete(venueEvents).where(eq(venueEvents.id, eventId));

            const [after] = await tx
                .select()
                .from(entityInteractions)
                .where(eq(entityInteractions.id, row.id));
            expect(after).toBeDefined();
            expect(after?.eventId).toBeNull();
        });
    });

    it('rolls up per kind and per event, and a re-run corrects instead of duplicating', async () => {
        await withTestTransaction(async (tx) => {
            const { venueId, eventId } = await seedVenueWithEvent(tx);
            await tx.insert(entityInteractions).values([
                {
                    entityType: 'VENUE',
                    entityId: venueId,
                    kind: 'PHONE_CLICK',
                    visitorHash: 'a',
                    occurredAt: AUG_10
                },
                {
                    entityType: 'VENUE',
                    entityId: venueId,
                    kind: 'PHONE_CLICK',
                    visitorHash: 'b',
                    occurredAt: AUG_10
                },
                {
                    entityType: 'VENUE',
                    entityId: venueId,
                    kind: 'PHONE_CLICK',
                    visitorHash: 'b',
                    occurredAt: AUG_20
                },
                {
                    entityType: 'VENUE',
                    entityId: venueId,
                    kind: 'TICKET_CLICK',
                    eventId,
                    visitorHash: 'a',
                    occurredAt: AUG_10
                }
            ]);

            const written = await model.rollUpMonth({ month: AUG_10 }, tx);

            expect(written).toBeGreaterThanOrEqual(2);
            const first = await readRollup(tx, venueId);
            expect(first).toHaveLength(2);
            const phone = first.find((r) => r.kind === 'PHONE_CLICK');
            const ticket = first.find((r) => r.kind === 'TICKET_CLICK');
            expect(phone).toMatchObject({ event_id: null, month: '2026-08-01' });
            expect(Number(phone?.unique_visitors)).toBe(2);
            // b's two taps are 10 days apart: two distinct 30-minute buckets.
            expect(Number(phone?.total)).toBe(3);
            expect(ticket?.event_id).toBe(eventId);

            // A late interaction, then a re-run: still one row per key (NULL event included).
            await tx.insert(entityInteractions).values({
                entityType: 'VENUE',
                entityId: venueId,
                kind: 'PHONE_CLICK',
                visitorHash: 'c',
                occurredAt: AUG_20
            });
            await model.rollUpMonth({ month: AUG_10 }, tx);

            const second = await readRollup(tx, venueId);
            expect(second).toHaveLength(2);
            const phone2 = second.find((r) => r.kind === 'PHONE_CLICK');
            expect(Number(phone2?.total)).toBe(4);
            expect(Number(phone2?.unique_visitors)).toBe(3);
        });
    });

    it('purges only rows older than the horizon and the rollup survives it (AC-12, AC-15)', async () => {
        await withTestTransaction(async (tx) => {
            const entityId = crypto.randomUUID();
            const old = new Date(Date.now() - 130 * 24 * 60 * 60 * 1000);
            const fresh = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
            await tx.insert(entityInteractions).values([
                {
                    entityType: 'VENUE',
                    entityId,
                    kind: 'MAP_CLICK',
                    visitorHash: 'a',
                    occurredAt: old
                },
                {
                    entityType: 'VENUE',
                    entityId,
                    kind: 'MAP_CLICK',
                    visitorHash: 'b',
                    occurredAt: fresh
                }
            ]);
            await model.rollUpMonth({ month: old }, tx);

            const deleted = await model.purgeOlderThan({ days: 120 }, tx);

            expect(deleted).toBeGreaterThanOrEqual(1);
            const left = await tx
                .select()
                .from(entityInteractions)
                .where(eq(entityInteractions.entityId, entityId));
            expect(left).toHaveLength(1);
            expect(left[0]?.visitorHash).toBe('b');
            const rolled = await readRollup(tx, entityId);
            expect(rolled).toHaveLength(1);
            expect(Number(rolled[0]?.total)).toBe(1);
        });
    });
});
