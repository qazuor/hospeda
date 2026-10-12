import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { count, domainEvent, emailOutbox, eq, listingPublicationModel, trials } from '@repo/db';
import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { archiveInactiveListing } from '../../src/publication/archive-inactive-listing';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import { runDailyCoverageReconciler } from '../../src/publication/coverage-reconciler';
import { liftModeration } from '../../src/publication/lift-moderation';
import { takeDownListing } from '../../src/publication/moderate-listing';
import { seedPublicationListing, seedPublicationOwner } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';
import { createReconcilerTestPorts } from './support/reconciler-test-ports';
import './support/moderation-transaction';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const now = new Date('2026-10-12T12:00:00.000Z');
const clock = { now: () => new Date(now) };
const vertical = VerticalEnum.ACCOMMODATION;
const afterCommit = {
    emitCoverageChanged: vi.fn(async () => {}),
    invalidateUser: vi.fn(async () => {}),
    revalidate: vi.fn(async () => {})
};
afterAll(async () => pool.end());

describe('TEST:V6:11 listing moderation against PostgreSQL', () => {
    it('TEST:V6:11 delegates PB10 over each listing vertical', async () => {
        const admin = await seedPublicationOwner({ db });
        const verticals = [
            VerticalEnum.ACCOMMODATION,
            VerticalEnum.GASTRONOMY,
            VerticalEnum.EXPERIENCE
        ] as const;
        for (const vertical of verticals) {
            const { userId, destinationId } = await seedPublicationOwner({ db });
            const listing = await seedPublicationListing({
                db,
                vertical,
                userId,
                destinationId,
                status: Status.DRAFT
            });
            const correlationId = randomUUID();
            const adapter = createPublicationTestAdapter({
                db,
                covered: { value: false },
                limit: { value: 1 }
            });
            expect(
                (
                    await takeDownListing({
                        ...adapter,
                        clock,
                        afterCommit,
                        adminId: admin.userId,
                        ownerId: userId,
                        vertical,
                        listingId: listing.id,
                        reason: 'cross vertical test',
                        correlationId
                    })
                ).ok
            ).toBe(true);
            expect(
                (
                    await listingPublicationModel.readListing({
                        tx: db,
                        vertical,
                        listingId: listing.id
                    })
                )?.publicationStatus
            ).toBe(Status.MODERATED);
            const notices = await db
                .select({ template: emailOutbox.template })
                .from(emailOutbox)
                .where(eq(emailOutbox.correlationId, correlationId));
            expect(notices).toEqual([{ template: 'verticals.listing-moderated' }]);
        }
    });

    it('TEST:V6:11 takes down listings from the four allowed statuses and preserves inactivity', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const admin = await seedPublicationOwner({ db });
        const statuses = [Status.DRAFT, Status.PUBLISHED, Status.UNPUBLISHED_BY_BILLING] as const;
        const listings = [];
        const origins = new Map<string, Status>();
        for (const status of statuses) {
            const listing = await seedPublicationListing({
                db,
                vertical,
                userId,
                destinationId,
                status
            });
            listings.push(listing);
            origins.set(listing.id, status);
        }
        const archived = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: Status.PUBLISHED
        });
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = ${new Date('2026-01-01T00:00:00.000Z')} WHERE id = ${archived.id}`
        );
        const archiveAdapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 2 }
        });
        expect(
            (
                await archiveInactiveListing({
                    ...archiveAdapter,
                    billing: {
                        ...archiveAdapter.billing,
                        coverage: async () => ({ covered: false, sources: [] }),
                        retentionStopped: async () => ({
                            stopped: false,
                            pauseEndedAt: null,
                            coverageLostAt: null
                        })
                    },
                    afterCommit,
                    clock,
                    vertical,
                    listingId: archived.id,
                    ownerId: userId,
                    correlationId: randomUUID()
                })
            ).archived
        ).toBe(true);
        listings.push(archived);
        origins.set(archived.id, Status.ARCHIVED);

        for (const listing of listings) {
            const before = await db.execute(
                sql`SELECT inactive_since, deadlines_version FROM accommodations WHERE id = ${listing.id}`
            );
            const correlationId = randomUUID();
            const adapter = createPublicationTestAdapter({
                db,
                covered: { value: false },
                limit: { value: 2 }
            });
            const result = await takeDownListing({
                ...adapter,
                clock,
                afterCommit,
                adminId: admin.userId,
                ownerId: userId,
                vertical,
                listingId: listing.id,
                reason: 'Review requested',
                correlationId
            });
            expect(result.ok).toBe(true);
            const current = await listingPublicationModel.readListing({
                tx: db,
                vertical,
                listingId: listing.id
            });
            expect(current?.publicationStatus).toBe(Status.MODERATED);
            const after = await db.execute(
                sql`SELECT inactive_since, deadlines_version FROM accommodations WHERE id = ${listing.id}`
            );
            expect(after.rows[0]).toEqual(before.rows[0]);
            const events = await db
                .select({
                    actorType: domainEvent.actorType,
                    actorId: domainEvent.actorId,
                    reason: domainEvent.reason,
                    changes: domainEvent.changes
                })
                .from(domainEvent)
                .where(eq(domainEvent.correlationId, correlationId));
            expect(events[0]).toMatchObject({
                actorType: 'admin',
                actorId: admin.userId,
                reason: 'Review requested'
            });
            expect(events[0]?.changes).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'publicationStatus',
                        old: origins.get(listing.id),
                        new: 'MODERATED'
                    })
                ])
            );
            if (listing === archived)
                expect(events[0]?.changes).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ field: 'archiveOrigin', new: 'PUBLISHED' })
                    ])
                );
            const notices = await db
                .select({
                    template: emailOutbox.template,
                    recipientUserId: emailOutbox.recipientUserId
                })
                .from(emailOutbox)
                .where(eq(emailOutbox.correlationId, correlationId));
            expect(notices).toEqual([
                expect.objectContaining({
                    template: 'verticals.listing-moderated',
                    recipientUserId: userId
                })
            ]);
        }
        const [trialCount] = await db
            .select({ value: count() })
            .from(trials)
            .where(eq(trials.userId, userId));
        expect(trialCount?.value).toBe(0);
    });

    it('TEST:V6:11 restores PB13 to publication when covered and leaves PB11 as DRAFT', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const admin = await seedPublicationOwner({ db });
        const draft = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: Status.DRAFT
        });
        const published = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: Status.PUBLISHED
        });
        const [draftBefore] = (
            await db.execute(
                sql`SELECT deadlines_version FROM accommodations WHERE id = ${draft.id}`
            )
        ).rows;
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 2 }
        });
        await takeDownListing({
            ...adapter,
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: draft.id,
            reason: 'draft review',
            correlationId: randomUUID()
        });
        await takeDownListing({
            ...adapter,
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: published.id,
            reason: 'listing review',
            correlationId: randomUUID()
        });
        const draftLift = await liftModeration({
            ...adapter,
            billing: { coverage: async () => ({ covered: true, sources: [] }) },
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: draft.id,
            reason: 'review cleared',
            correlationId: randomUUID(),
            keepFixRequest: false
        });
        expect(draftLift).toMatchObject({
            ok: true,
            transition: 'PB11',
            publicationStatus: Status.DRAFT
        });
        const [draftAfter] = (
            await db.execute(
                sql`SELECT inactive_since, deadlines_version FROM accommodations WHERE id = ${draft.id}`
            )
        ).rows;
        expect(new Date(String(draftAfter?.inactive_since))).toEqual(now);
        expect(draftAfter?.deadlines_version).toEqual(draftBefore?.deadlines_version);
        const publishedLift = await liftModeration({
            ...adapter,
            billing: { coverage: async () => ({ covered: true, sources: [] }) },
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: published.id,
            reason: 'review cleared',
            correlationId: randomUUID(),
            keepFixRequest: false
        });
        expect(publishedLift).toMatchObject({
            ok: true,
            transition: 'PB13',
            publicationStatus: Status.PUBLISHED
        });
        const uncovered = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: Status.UNPUBLISHED_BY_BILLING
        });
        await takeDownListing({
            ...adapter,
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: uncovered.id,
            reason: 'review',
            correlationId: randomUUID()
        });
        const uncoveredLift = await liftModeration({
            ...adapter,
            billing: { coverage: async () => ({ covered: false, sources: [] }) },
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: uncovered.id,
            reason: 'cleared',
            correlationId: randomUUID(),
            keepFixRequest: false
        });
        expect(uncoveredLift).toMatchObject({
            ok: true,
            transition: 'PB13',
            publicationStatus: Status.UNPUBLISHED_BY_BILLING
        });
    });

    it('TEST:V6:11 rolls an enqueued notice back when PB10 transaction fails', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const admin = await seedPublicationOwner({ db });
        const listing = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: Status.DRAFT
        });
        const correlationId = randomUUID();
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 1 },
            afterEnqueueListingNotice: async () => {
                throw new Error('rollback after enqueue');
            }
        });
        await expect(
            takeDownListing({
                ...adapter,
                clock,
                afterCommit,
                adminId: admin.userId,
                ownerId: userId,
                vertical,
                listingId: listing.id,
                reason: 'review',
                correlationId
            })
        ).rejects.toThrow('rollback after enqueue');
        const notices = await db
            .select({ id: emailOutbox.id })
            .from(emailOutbox)
            .where(eq(emailOutbox.correlationId, correlationId));
        expect(notices).toHaveLength(0);
        const current = await listingPublicationModel.readListing({
            tx: db,
            vertical,
            listingId: listing.id
        });
        expect(current?.publicationStatus).toBe(Status.DRAFT);
    });

    it('TEST:V6:11 keeps MODERATED out of PB3, PB7, the reconciler and published counts', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const admin = await seedPublicationOwner({ db });
        const listing = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: Status.PUBLISHED
        });
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 }
        });
        await takeDownListing({
            ...adapter,
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: listing.id,
            reason: 'review',
            correlationId: randomUUID()
        });
        const before = await db
            .select({ id: domainEvent.id })
            .from(domainEvent)
            .where(eq(domainEvent.entityId, listing.id));
        const inactiveBefore = await db.execute(
            sql`SELECT inactive_since FROM accommodations WHERE id = ${listing.id}`
        );
        await recalculateCoverage({
            ...adapter,
            billing: { coverage: async () => ({ covered: true, sources: [] }) },
            clock: { now: () => new Date(now.getTime() + 60_000) },
            afterCommit,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        const archived = await archiveInactiveListing({
            ...adapter,
            billing: {
                coverage: async () => ({ covered: true, sources: [] }),
                retentionStopped: async () => ({
                    stopped: false,
                    pauseEndedAt: null,
                    coverageLostAt: null
                })
            },
            afterCommit,
            clock,
            vertical,
            listingId: listing.id,
            ownerId: userId,
            correlationId: randomUUID()
        });
        expect(archived).toMatchObject({ archived: false, reason: 'STATE_CHANGED' });
        const ports = createReconcilerTestPorts({
            db,
            coveredByUser: new Map([[userId, true]]),
            limitByUser: new Map([[userId, 1]])
        });
        await runDailyCoverageReconciler({ ports });
        const current = await listingPublicationModel.readListing({
            tx: db,
            vertical,
            listingId: listing.id
        });
        expect(current?.publicationStatus).toBe(Status.MODERATED);
        const inactiveAfter = await db.execute(
            sql`SELECT inactive_since FROM accommodations WHERE id = ${listing.id}`
        );
        expect(inactiveAfter.rows).toEqual(inactiveBefore.rows);
        expect(
            await listingPublicationModel.countPublished({ tx: db, vertical, ownerId: userId })
        ).toBe(0);
        const after = await db
            .select({ id: domainEvent.id })
            .from(domainEvent)
            .where(eq(domainEvent.entityId, listing.id));
        expect(after).toHaveLength(before.length);
        const [trialCount] = await db
            .select({ value: count() })
            .from(trials)
            .where(eq(trials.userId, userId));
        expect(trialCount?.value).toBe(0);
    });
});
