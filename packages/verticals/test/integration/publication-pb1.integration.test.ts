import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { trials } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { listingPublicationModel } from '../../../db/src/models/listing/listing-publication.model';
import { publishListing } from '../../src/publication/publish-listing';
import { unpublishListing } from '../../src/publication/unpublish-listing';
import {
    publicationPseudonym,
    seedPublicationListing,
    seedPublicationOwner
} from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
afterAll(async () => pool.end());
const vertical = VerticalEnum.ACCOMMODATION;
const clock = { now: () => new Date('2026-10-10T12:00:00.000Z') };
const afterCommit = {
    emitCoverageChanged: vi.fn(async () => {}),
    invalidateUser: vi.fn(async () => {}),
    revalidate: vi.fn(async () => {})
};

function publish(args: {
    userId: string;
    listingId: string;
    adapter: ReturnType<typeof createPublicationTestAdapter>;
}) {
    return publishListing({
        ...args.adapter,
        afterCommit,
        clock,
        userId: args.userId,
        listingId: args.listingId,
        vertical,
        event: 'listing_published',
        emailPseudonym: publicationPseudonym(),
        correlationId: randomUUID()
    });
}

describe('TEST:V6:2 - PB1 over Postgres', () => {
    it('publishes covered DRAFT and revalidates', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const listing = await seedPublicationListing({ db, vertical, userId, destinationId });
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 }
        });
        const result = await publish({ userId, listingId: listing.id, adapter });
        expect(result).toMatchObject({ published: true, trialStarted: false });
        expect(
            (await listingPublicationModel.readListing({ tx: db, vertical, listingId: listing.id }))
                ?.publicationStatus
        ).toBe(PublicationStatusEnum.PUBLISHED);
        expect(afterCommit.revalidate).toHaveBeenCalledWith({ vertical, listingIds: [listing.id] });
    });

    it('starts T1 and publishes DRAFT in the same commit', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const listing = await seedPublicationListing({ db, vertical, userId, destinationId });
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 1 }
        });
        const result = await publish({ userId, listingId: listing.id, adapter });
        expect(result).toMatchObject({ published: true, trialStarted: true });
        expect((await db.select().from(trials).where(eq(trials.userId, userId))).length).toBe(1);
        expect(
            (await listingPublicationModel.readListing({ tx: db, vertical, listingId: listing.id }))
                ?.publicationStatus
        ).toBe(PublicationStatusEnum.PUBLISHED);
    });

    it('refuses without coverage and with trial spent', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const first = await seedPublicationListing({ db, vertical, userId, destinationId });
        const second = await seedPublicationListing({ db, vertical, userId, destinationId });
        const covered = { value: false };
        const adapter = createPublicationTestAdapter({ db, covered, limit: { value: 1 } });
        expect((await publish({ userId, listingId: first.id, adapter })).published).toBe(true);
        expect(
            await unpublishListing({
                unitOfWork: adapter.unitOfWork,
                afterCommit,
                clock,
                userId,
                vertical,
                listingId: first.id,
                correlationId: randomUUID()
            })
        ).toMatchObject({ unpublished: true });
        const result = await publish({ userId, listingId: second.id, adapter });
        expect(result).toEqual({ published: false, reason: 'USER_ALREADY_HAS_TRIAL_ROW' });
        expect(
            (await listingPublicationModel.readListing({ tx: db, vertical, listingId: second.id }))
                ?.publicationStatus
        ).toBe(PublicationStatusEnum.DRAFT);
    });

    it('publishes UNPUBLISHED_BY_BILLING only through T1, not while covered', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const listing = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        });
        const covered = { value: true };
        const adapter = createPublicationTestAdapter({ db, covered, limit: { value: 1 } });
        expect(await publish({ userId, listingId: listing.id, adapter })).toEqual({
            published: false,
            reason: 'COVERED_USE_PB3'
        });
        covered.value = false;
        expect(await publish({ userId, listingId: listing.id, adapter })).toMatchObject({
            published: true,
            trialStarted: true
        });
        expect(
            (await listingPublicationModel.readListing({ tx: db, vertical, listingId: listing.id }))
                ?.publicationStatus
        ).toBe(PublicationStatusEnum.PUBLISHED);
    });
});
