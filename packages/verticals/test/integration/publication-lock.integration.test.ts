import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { listingPublicationModel } from '../../../db/src/models/listing/listing-publication.model';
import { archiveInactiveListing } from '../../src/publication/archive-inactive-listing';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import { publishListing } from '../../src/publication/publish-listing';
import { reactivateListing } from '../../src/publication/reactivate-listing';
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
const clock = { now: () => new Date('2026-10-10T14:00:00.000Z') };
const afterCommit = {
    emitCoverageChanged: async () => {},
    invalidateUser: async () => {},
    revalidate: async () => {}
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

describe('TEST:V6:3 - publication lock with two real connections', () => {
    it('two PB1 calls with one place leave exactly one PUBLISHED', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const first = await seedPublicationListing({ db, vertical, userId, destinationId });
        const second = await seedPublicationListing({ db, vertical, userId, destinationId });
        let atWrite: () => void = () => {};
        const firstCounted = new Promise<void>((resolve) => {
            atWrite = resolve;
        });
        const firstAdapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 },
            beforeSetPublicationStatus: async () => {
                atWrite();
                await new Promise<void>((resolve) => setTimeout(resolve, 250));
            }
        });
        const secondAdapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 }
        });
        const publishingFirst = publish({ userId, listingId: first.id, adapter: firstAdapter });
        await firstCounted;
        const outcomes = await Promise.all([
            publishingFirst,
            publish({ userId, listingId: second.id, adapter: secondAdapter })
        ]);
        expect(outcomes.filter((outcome) => outcome.published)).toHaveLength(1);
        expect(outcomes.filter((outcome) => !outcome.published)).toMatchObject([
            { published: false, reason: 'LIMIT_REACHED' }
        ]);
        expect(
            await listingPublicationModel.countPublished({ tx: db, vertical, ownerId: userId })
        ).toBe(1);
    });

    it('PB1 followed by concurrent PB2 leaves no publication without coverage', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const listing = await seedPublicationListing({ db, vertical, userId, destinationId });
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        let entered: () => void = () => {};
        const locked = new Promise<void>((resolve) => {
            entered = resolve;
        });
        const pb1 = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 },
            onLocked: async () => {
                entered();
                await gate;
            }
        });
        const pb2 = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 1 }
        });
        const publishing = publish({ userId, listingId: listing.id, adapter: pb1 });
        await locked;
        const lowering = recalculateCoverage({
            ...pb2,
            afterCommit,
            clock,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        release();
        const [published, lowered] = await Promise.all([publishing, lowering]);
        expect(published).toMatchObject({ published: true });
        expect(lowered.lowered).toEqual([listing.id]);
        expect(
            (await listingPublicationModel.readListing({ tx: db, vertical, listingId: listing.id }))
                ?.publicationStatus
        ).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
    });

    it('PB6 and PB2 reread the source state and never overwrite DRAFT', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const listing = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 1 }
        });
        const [owner, billing] = await Promise.all([
            unpublishListing({
                unitOfWork: adapter.unitOfWork,
                afterCommit,
                clock,
                userId,
                vertical,
                listingId: listing.id,
                correlationId: randomUUID()
            }),
            recalculateCoverage({
                ...adapter,
                afterCommit,
                clock,
                userId,
                vertical,
                correlationId: randomUUID()
            })
        ]);
        const state = (
            await listingPublicationModel.readListing({ tx: db, vertical, listingId: listing.id })
        )?.publicationStatus;
        expect([
            PublicationStatusEnum.DRAFT,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        ]).toContain(state);
        expect(owner.unpublished && billing.lowered.length === 1).toBe(false);
    });

    it('PB3 and PB6 serialize and PB6 sees the restored PUBLISHED state', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const listing = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        });
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        let entered: () => void = () => {};
        const locked = new Promise<void>((resolve) => {
            entered = resolve;
        });
        const pb3 = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 },
            onLocked: async () => {
                entered();
                await gate;
            }
        });
        const pb6 = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 }
        });
        const restoring = recalculateCoverage({
            ...pb3,
            afterCommit,
            clock,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        await locked;
        const unpublishing = unpublishListing({
            unitOfWork: pb6.unitOfWork,
            afterCommit,
            clock,
            userId,
            vertical,
            listingId: listing.id,
            correlationId: randomUUID()
        });
        release();
        const [restored, owner] = await Promise.all([restoring, unpublishing]);
        expect(restored.restored).toEqual([listing.id]);
        expect(owner).toMatchObject({ unpublished: true });
        expect(
            (await listingPublicationModel.readListing({ tx: db, vertical, listingId: listing.id }))
                ?.publicationStatus
        ).toBe(PublicationStatusEnum.DRAFT);
    });

    it('TEST:V6:3 PB5 and PB1 serialize on the same due DRAFT and the second transition rereads ARCHIVED', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const listing = await seedPublicationListing({ db, vertical, userId, destinationId });
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = '2026-01-01T00:00:00Z', deadlines_version = 1 WHERE id = ${listing.id}`
        );
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        let entered: () => void = () => {};
        const locked = new Promise<void>((resolve) => {
            entered = resolve;
        });
        const pb5 = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 1 },
            onLocked: async () => {
                entered();
                await gate;
            }
        });
        const pb1 = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 }
        });
        const archiving = archiveInactiveListing({
            ...pb5,
            afterCommit,
            clock,
            vertical,
            listingId: listing.id,
            ownerId: userId,
            correlationId: randomUUID()
        });
        await locked;
        const publishing = publish({ userId, listingId: listing.id, adapter: pb1 });
        release();
        const [archived, published] = await Promise.all([archiving, publishing]);
        expect(archived).toMatchObject({ archived: true, transition: 'PB5' });
        expect(published.published).toBe(false);
        expect(
            (await listingPublicationModel.readListing({ tx: db, vertical, listingId: listing.id }))
                ?.publicationStatus
        ).toBe(PublicationStatusEnum.ARCHIVED);
        const events = await db.execute(
            sql`SELECT count(*)::int AS count FROM domain_event WHERE entity_type = 'accommodation' AND entity_id = ${listing.id} AND changes @> '[{"field":"publicationStatus","new":"ARCHIVED"}]'::jsonb`
        );
        expect(events.rows[0]?.count).toBe(1);
    });

    it('TEST:V6:3 PB8 and PB7 serialize on one PB4 archive and emit one ARCHIVED exit', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const listing = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = '2026-01-01T00:00:00Z', deadlines_version = 1 WHERE id = ${listing.id}`
        );
        const archivePorts = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 1 }
        });
        expect(
            (
                await archiveInactiveListing({
                    ...archivePorts,
                    afterCommit,
                    clock,
                    vertical,
                    listingId: listing.id,
                    ownerId: userId,
                    correlationId: randomUUID()
                })
            ).archived
        ).toBe(true);
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        let entered: () => void = () => {};
        const locked = new Promise<void>((resolve) => {
            entered = resolve;
        });
        const pb7 = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 },
            onLocked: async () => {
                entered();
                await gate;
            }
        });
        const pb8 = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 1 }
        });
        const returning = recalculateCoverage({
            ...pb7,
            afterCommit,
            clock,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        await locked;
        const reactivating = reactivateListing({
            ...pb8,
            afterCommit,
            clock,
            userId,
            vertical,
            listingId: listing.id,
            correlationId: randomUUID()
        });
        release();
        const [restored, owner] = await Promise.all([returning, reactivating]);
        expect(restored.restoredFromArchived).toEqual([listing.id]);
        expect(owner).toEqual({ reactivated: false, reason: 'INVALID_FROM' });
        expect(
            (await listingPublicationModel.readListing({ tx: db, vertical, listingId: listing.id }))
                ?.publicationStatus
        ).toBe(PublicationStatusEnum.PUBLISHED);
        const exits = await db.execute(
            sql`SELECT count(*)::int AS count FROM domain_event WHERE entity_type = 'accommodation' AND entity_id = ${listing.id} AND changes @> '[{"field":"publicationStatus","old":"ARCHIVED"}]'::jsonb`
        );
        expect(exits.rows[0]?.count).toBe(1);
    });
});
