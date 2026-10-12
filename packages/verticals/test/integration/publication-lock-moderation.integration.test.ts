import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { domainEvent, eq, listingPublicationModel } from '@repo/db';
import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import { takeDownListing } from '../../src/publication/moderate-listing';
import { seedPublicationListing, seedPublicationOwner } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const vertical = VerticalEnum.ACCOMMODATION;
const clock = { now: () => new Date('2026-10-12T12:00:00.000Z') };
const afterCommit = {
    emitCoverageChanged: vi.fn(async () => {}),
    invalidateUser: vi.fn(async () => {}),
    revalidate: vi.fn(async () => {})
};
afterAll(async () => pool.end());

describe('TEST:V6:3 PB10 and PB3 under the shared owner lock', () => {
    it('TEST:V6:3 serializes PB10 with PB3 and rereads the current source state', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const admin = await seedPublicationOwner({ db });
        const listing = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: Status.UNPUBLISHED_BY_BILLING
        });
        let release: () => void = () => {};
        let acquired: () => void = () => {};
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const locked = new Promise<void>((resolve) => {
            acquired = resolve;
        });
        let pb10AcquiredLock = false;
        const first = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 },
            onLocked: async () => {
                acquired();
                await gate;
            }
        });
        const second = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 },
            onLocked: async () => {
                pb10AcquiredLock = true;
            }
        });
        const pb3 = recalculateCoverage({
            ...first,
            billing: first.billing,
            clock,
            afterCommit,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        await locked;
        const pb10 = takeDownListing({
            ...second,
            clock,
            afterCommit,
            adminId: admin.userId,
            ownerId: userId,
            vertical,
            listingId: listing.id,
            reason: 'Admin review',
            correlationId: randomUUID()
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 75));
        expect(pb10AcquiredLock).toBe(false);
        release();
        await Promise.all([pb3, pb10]);

        const final = await listingPublicationModel.readListing({
            tx: db,
            vertical,
            listingId: listing.id
        });
        expect(final?.publicationStatus).toBe(Status.MODERATED);
        const events = await db
            .select({ changes: domainEvent.changes, actorType: domainEvent.actorType })
            .from(domainEvent)
            .where(eq(domainEvent.entityId, listing.id));
        const moderation = events.filter(({ changes }) =>
            changes.some(
                (change) => change.field === 'publicationStatus' && change.new === Status.MODERATED
            )
        );
        expect(moderation).toHaveLength(1);
        expect(moderation[0]?.changes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: 'publicationStatus',
                    old: expect.stringMatching(/UNPUBLISHED_BY_BILLING|PUBLISHED/),
                    new: 'MODERATED'
                })
            ])
        );
        const pb3Publishes = events.filter(
            ({ actorType, changes }) =>
                actorType === 'job' &&
                changes.some(
                    (change) =>
                        change.field === 'publicationStatus' && change.new === Status.PUBLISHED
                )
        );
        expect(pb3Publishes.length).toBeLessThanOrEqual(1);
        const source = moderation[0]?.changes.find(
            (change) => change.field === 'publicationStatus'
        )?.old;
        expect(source).toBe(
            pb3Publishes.length === 1 ? Status.PUBLISHED : Status.UNPUBLISHED_BY_BILLING
        );
    });
});
