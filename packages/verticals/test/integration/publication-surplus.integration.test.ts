import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { domainEventModel } from '../../../db/src/models/domain-event/domain-event.model';
import { listingPublicationModel } from '../../../db/src/models/listing/listing-publication.model';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import { seedPublicationListing, seedPublicationOwner } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 6 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const vertical = VerticalEnum.ACCOMMODATION;
const eventAt = (day: number) => new Date(`2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`);
const clock = { now: () => new Date('2026-10-10T13:00:00.000Z') };
const afterCommit = {
    emitCoverageChanged: async () => {},
    invalidateUser: async () => {},
    revalidate: async () => {}
};

afterAll(async () => pool.end());

describe('publication surplus in both directions', () => {
    it('TEST:V6:5 lowers newest first and restores in reverse while preserving PB1 instants', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const listings = [];
        for (let index = 1; index <= 5; index += 1) {
            const listing = await seedPublicationListing({
                db,
                vertical,
                userId,
                destinationId,
                status: PublicationStatusEnum.PUBLISHED
            });
            listings.push(listing);
            await listingPublicationModel.insertStatusChangedEvent({
                tx: db,
                vertical,
                listingId: listing.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED,
                actorType: 'owner',
                actorId: userId,
                correlationId: randomUUID(),
                occurredAt: eventAt(index)
            });
        }
        const noiseStatuses = [
            PublicationStatusEnum.DRAFT,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            PublicationStatusEnum.ARCHIVED,
            PublicationStatusEnum.MODERATED,
            PublicationStatusEnum.PURGED
        ];
        const noise = [];
        for (const status of noiseStatuses) {
            const row = await seedPublicationListing({
                db,
                vertical,
                userId,
                destinationId,
                status
            });
            noise.push(row);
            if (status === PublicationStatusEnum.UNPUBLISHED_BY_BILLING) {
                await listingPublicationModel.insertStatusChangedEvent({
                    tx: db,
                    vertical,
                    listingId: row.id,
                    from: PublicationStatusEnum.DRAFT,
                    to: PublicationStatusEnum.PUBLISHED,
                    actorType: 'owner',
                    actorId: userId,
                    correlationId: randomUUID(),
                    occurredAt: eventAt(6)
                });
            }
        }
        const covered = { value: true };
        const limit = { value: 3 };
        const adapter = createPublicationTestAdapter({ db, covered, limit });
        const initialInstants = await listingPublicationModel.readPublicationInstants({
            tx: db,
            vertical,
            listingIds: listings.map((row) => row.id)
        });
        const down = await recalculateCoverage({
            ...adapter,
            afterCommit,
            clock,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        expect(down.lowered).toEqual([listings[4]?.id, listings[3]?.id]);
        expect(down.loweredBySurplus).toEqual([listings[4]?.id, listings[3]?.id]);
        expect(down.stamped).not.toEqual(
            expect.arrayContaining([listings[3]?.id, listings[4]?.id])
        );
        for (const index of [0, 1, 2]) {
            expect(
                (
                    await listingPublicationModel.readListing({
                        tx: db,
                        vertical,
                        listingId: listings[index]!.id
                    })
                )?.publicationStatus
            ).toBe(PublicationStatusEnum.PUBLISHED);
        }
        const afterNoise = await Promise.all(
            noise.map((row) =>
                listingPublicationModel.readListing({ tx: db, vertical, listingId: row.id })
            )
        );
        expect(afterNoise.map((row) => row?.publicationStatus)).toEqual(noiseStatuses);
        for (const index of [3, 4]) {
            const row = await listingPublicationModel.readListing({
                tx: db,
                vertical,
                listingId: listings[index]!.id
            });
            expect(row?.publicationStatus).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
            const eventRows = await db.execute(
                sql`SELECT actor_type FROM domain_event WHERE entity_id = ${listings[index]!.id} AND changes @> '[{"field":"publicationStatus","new":"UNPUBLISHED_BY_BILLING"}]'::jsonb`
            );
            expect(eventRows.rows).toHaveLength(1);
            expect(eventRows.rows[0]?.actor_type).toBe('job');
        }
        const eventsBeforeRetry = await Promise.all(
            listings.map((row) =>
                domainEventModel.findByEntity({ tx: db, entityType: vertical, entityId: row.id })
            )
        );
        await recalculateCoverage({
            ...adapter,
            afterCommit,
            clock,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        const eventsAfterRetry = await Promise.all(
            listings.map((row) =>
                domainEventModel.findByEntity({ tx: db, entityType: vertical, entityId: row.id })
            )
        );
        expect(eventsAfterRetry.map((events) => events.length)).toEqual(
            eventsBeforeRetry.map((events) => events.length)
        );
        expect(
            (
                await Promise.all(
                    listings.map((row) =>
                        listingPublicationModel.readListing({ tx: db, vertical, listingId: row.id })
                    )
                )
            ).filter((row) => row?.publicationStatus === PublicationStatusEnum.PUBLISHED)
        ).toHaveLength(3);
        limit.value = 5;
        const up = await recalculateCoverage({
            ...adapter,
            afterCommit,
            clock,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        expect(up.restored).toEqual([listings[3]?.id, listings[4]?.id]);
        expect(
            await listingPublicationModel.readPublicationInstants({
                tx: db,
                vertical,
                listingIds: [listings[3]!.id, listings[4]!.id]
            })
        ).toEqual(
            new Map([
                [listings[3]!.id, initialInstants.get(listings[3]!.id)],
                [listings[4]!.id, initialInstants.get(listings[4]!.id)]
            ])
        );
        const finalStatuses = await Promise.all(
            listings.map(
                async (listing) =>
                    (
                        await listingPublicationModel.readListing({
                            tx: db,
                            vertical,
                            listingId: listing.id
                        })
                    )?.publicationStatus
            )
        );
        expect(finalStatuses).toEqual(Array(5).fill(PublicationStatusEnum.PUBLISHED));
    });

    it('TEST:V6:4 excludes surplus lowering from inactive_since writes', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const listing = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        await listingPublicationModel.insertStatusChangedEvent({
            tx: db,
            vertical,
            listingId: listing.id,
            from: PublicationStatusEnum.DRAFT,
            to: PublicationStatusEnum.PUBLISHED,
            actorType: 'owner',
            actorId: userId,
            correlationId: randomUUID(),
            occurredAt: eventAt(1)
        });
        const before = await db.execute(
            sql`SELECT inactive_since, deadlines_version FROM accommodations WHERE id = ${listing.id}`
        );
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 0 }
        });
        const result = await recalculateCoverage({
            ...adapter,
            afterCommit,
            clock,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        expect(result.loweredBySurplus).toEqual([listing.id]);
        const after = await db.execute(
            sql`SELECT inactive_since, deadlines_version FROM accommodations WHERE id = ${listing.id}`
        );
        expect(after.rows[0]).toEqual(before.rows[0]);
    });

    it('TEST:V6:5 produces the same published set after different limit paths', async () => {
        const firstOwner = await seedPublicationOwner({ db });
        const directOwner = await seedPublicationOwner({ db });
        const covered = { value: true };
        const limit = { value: 5 };
        const firstAdapter = createPublicationTestAdapter({ db, covered, limit });
        const directAdapter = createPublicationTestAdapter({ db, covered, limit });
        const seedFive = async (ownerId: string, destinationId: string) => {
            const rows = [];
            for (let index = 1; index <= 5; index += 1) {
                const row = await seedPublicationListing({
                    db,
                    vertical,
                    userId: ownerId,
                    destinationId,
                    status: PublicationStatusEnum.PUBLISHED
                });
                rows.push(row);
                await listingPublicationModel.insertStatusChangedEvent({
                    tx: db,
                    vertical,
                    listingId: row.id,
                    from: PublicationStatusEnum.DRAFT,
                    to: PublicationStatusEnum.PUBLISHED,
                    actorType: 'owner',
                    actorId: ownerId,
                    correlationId: randomUUID(),
                    occurredAt: eventAt(index)
                });
            }
            return rows;
        };
        const firstRows = await seedFive(firstOwner.userId, firstOwner.destinationId);
        const directRows = await seedFive(directOwner.userId, directOwner.destinationId);
        for (const nextLimit of [2, 4, 3, 4]) {
            limit.value = nextLimit;
            await recalculateCoverage({
                ...firstAdapter,
                afterCommit,
                clock,
                userId: firstOwner.userId,
                vertical,
                correlationId: randomUUID()
            });
        }
        limit.value = 4;
        await recalculateCoverage({
            ...directAdapter,
            afterCommit,
            clock,
            userId: directOwner.userId,
            vertical,
            correlationId: randomUUID()
        });
        const publishedIndexes = async (rows: typeof firstRows) => {
            const stored = await Promise.all(
                rows.map((row) =>
                    listingPublicationModel.readListing({ tx: db, vertical, listingId: row.id })
                )
            );
            return stored
                .map((row, index) =>
                    row?.publicationStatus === PublicationStatusEnum.PUBLISHED ? index : -1
                )
                .filter((index) => index >= 0);
        };
        expect(await publishedIndexes(firstRows)).toEqual([0, 1, 2, 3]);
        expect(await publishedIndexes(firstRows)).toEqual(await publishedIndexes(directRows));
    });

    it('TEST:V6:5 leaves published listings alone when the limit is undeclared', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const rows = [];
        for (let index = 0; index < 5; index += 1) {
            rows.push(
                await seedPublicationListing({
                    db,
                    vertical,
                    userId,
                    destinationId,
                    status: PublicationStatusEnum.PUBLISHED
                })
            );
        }
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 0 },
            declaredLimit: { value: null }
        });
        const result = await recalculateCoverage({
            ...adapter,
            afterCommit,
            clock,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        expect(result.loweredBySurplus).toEqual([]);
        expect(result.restored).toEqual([]);
        const stored = await Promise.all(
            rows.map((row) =>
                listingPublicationModel.readListing({ tx: db, vertical, listingId: row.id })
            )
        );
        expect(stored.map((row) => row?.publicationStatus)).toEqual(
            Array(5).fill(PublicationStatusEnum.PUBLISHED)
        );
    });
});
