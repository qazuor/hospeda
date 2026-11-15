/**
 * Integration test: listingLocationModel (HOS-1810, one-address rule).
 *
 * The SQL behind the rule, per vertical: same-owner occupant lookup (published,
 * live, no exception, other id), exception grant/removal and the repeated-address
 * groups with `sameOwner`. A venue never sees an accommodation's key.
 */
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { listingLocationModel } from '../../src/models/listing/listing-location.model.ts';
import { listingPublicationModel } from '../../src/models/listing/listing-publication.model.ts';
import { accommodations, destinations, users, venues } from '../../src/schemas/index.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, getTestDb, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

const KEY = 'mitre|10|dest';

async function seedOwner(tx: DrizzleClient) {
    const [owner] = await tx
        .insert(users)
        .values(testData.user({ role: 'HOST' }))
        .returning();
    if (!owner) throw new Error('owner');
    return owner;
}

async function seedDestination(tx: DrizzleClient, ownerId: string) {
    const [destination] = await tx
        .insert(destinations)
        .values(testData.destination({ ownerId }))
        .returning();
    if (!destination) throw new Error('destination');
    return destination;
}

type Fixture = {
    ownerId: string;
    destinationId: string;
    key?: string | null;
    status?: PublicationStatusEnum;
    deletedAt?: Date | null;
    exception?: boolean;
    /** Key the exception was granted for; defaults to the row's own key. */
    exceptionKey?: string | null;
};

async function insertAccommodation(tx: DrizzleClient, f: Fixture) {
    const uid = crypto.randomUUID().slice(0, 8);
    const [row] = await tx
        .insert(accommodations)
        .values({
            publicationStatus: f.status ?? PublicationStatusEnum.PUBLISHED,
            inactiveSince: new Date(),
            deadlinesVersion: 1,
            ownerId: f.ownerId,
            destinationId: f.destinationId,
            slug: `hos1810-a-${uid}`,
            name: 'HOS-1810 accommodation',
            summary: 'summary of the fixture',
            type: 'HOUSE',
            description: 'description of the fixture',
            locationKey: f.key === undefined ? KEY : f.key,
            deletedAt: f.deletedAt ?? null,
            locationExceptionAt: f.exception ? new Date() : null,
            locationExceptionKey: f.exception
                ? f.exceptionKey === undefined
                    ? f.key === undefined
                        ? KEY
                        : f.key
                    : f.exceptionKey
                : null
        })
        .returning();
    if (!row) throw new Error('accommodation');
    return row;
}

async function insertVenue(tx: DrizzleClient, f: Fixture) {
    const uid = crypto.randomUUID().slice(0, 8);
    const [row] = await tx
        .insert(venues)
        .values({
            publicationStatus: f.status ?? PublicationStatusEnum.PUBLISHED,
            inactiveSince: new Date(),
            deadlinesVersion: 1,
            ownerId: f.ownerId,
            destinationId: f.destinationId,
            slug: `hos1810-v-${uid}`,
            name: 'HOS-1810 venue',
            summary: 'summary of the fixture',
            type: 'RESTAURANT',
            businessLines: ['food'],
            description: 'description of the fixture',
            locationKey: f.key === undefined ? KEY : f.key,
            deletedAt: f.deletedAt ?? null,
            locationExceptionAt: f.exception ? new Date() : null,
            locationExceptionKey: f.exception
                ? f.exceptionKey === undefined
                    ? f.key === undefined
                        ? KEY
                        : f.key
                    : f.exceptionKey
                : null
        })
        .returning();
    if (!row) throw new Error('venue');
    return row;
}

const find = (
    tx: DrizzleClient,
    vertical: VerticalEnum.ACCOMMODATION | VerticalEnum.VENUE,
    ownerId: string,
    excludeId: string
) => listingLocationModel.findOwnOccupant({ vertical, locationKey: KEY, ownerId, excludeId, tx });

describe('listingLocationModel (HOS-1810)', () => {
    it('finds a published same-owner occupant, excluding the listing itself', async () => {
        await withTestTransaction(async (tx) => {
            const owner = await seedOwner(tx);
            const dest = await seedDestination(tx, owner.id);
            const a = await insertAccommodation(tx, { ownerId: owner.id, destinationId: dest.id });
            const b = await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                status: PublicationStatusEnum.DRAFT
            });
            expect(await find(tx, VerticalEnum.ACCOMMODATION, owner.id, b.id)).toBe(a.id);
            expect(await find(tx, VerticalEnum.ACCOMMODATION, owner.id, a.id)).toBeNull();
        });
    });

    it('ignores drafts, archived, deleted, excepted and other-owner listings', async () => {
        await withTestTransaction(async (tx) => {
            const owner = await seedOwner(tx);
            const other = await seedOwner(tx);
            const dest = await seedDestination(tx, owner.id);
            const me = await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                status: PublicationStatusEnum.DRAFT
            });
            await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                status: PublicationStatusEnum.DRAFT
            });
            await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                status: PublicationStatusEnum.ARCHIVED
            });
            await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                deletedAt: new Date()
            });
            await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                exception: true
            });
            await insertAccommodation(tx, { ownerId: other.id, destinationId: dest.id });
            expect(await find(tx, VerticalEnum.ACCOMMODATION, owner.id, me.id)).toBeNull();
        });
    });

    it('is per vertical: a venue never collides with an accommodation', async () => {
        await withTestTransaction(async (tx) => {
            const owner = await seedOwner(tx);
            const dest = await seedDestination(tx, owner.id);
            const acc = await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id
            });
            const venue = await insertVenue(tx, { ownerId: owner.id, destinationId: dest.id });
            expect(await find(tx, VerticalEnum.VENUE, owner.id, venue.id)).toBeNull();
            expect(await find(tx, VerticalEnum.ACCOMMODATION, owner.id, acc.id)).toBeNull();
            const venue2 = await insertVenue(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                status: PublicationStatusEnum.DRAFT
            });
            expect(await find(tx, VerticalEnum.VENUE, owner.id, venue2.id)).toBe(venue.id);
        });
    });

    it('grants and clears an exception, and reports state and the draft warning', async () => {
        await withTestTransaction(async (tx) => {
            const owner = await seedOwner(tx);
            const dest = await seedDestination(tx, owner.id);
            await insertVenue(tx, { ownerId: owner.id, destinationId: dest.id });
            const draft = await insertVenue(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                status: PublicationStatusEnum.DRAFT
            });
            const args = { vertical: VerticalEnum.VENUE, id: draft.id, tx } as const;
            expect(await listingLocationModel.hasOwnDuplicate(args)).toBe(true);

            const ok = await listingLocationModel.setException({
                ...args,
                adminId: owner.id,
                reason: 'Food court',
                at: new Date()
            });
            expect(ok).toBe('granted');
            expect((await listingLocationModel.getState(args))?.hasException).toBe(true);
            expect(await listingLocationModel.hasOwnDuplicate(args)).toBe(false);

            expect(await listingLocationModel.clearException(args)).toBe(true);
            expect((await listingLocationModel.getState(args))?.hasException).toBe(false);
            expect(
                await listingLocationModel.setException({
                    ...args,
                    id: crypto.randomUUID(),
                    adminId: owner.id,
                    reason: 'x',
                    at: new Date()
                })
            ).toBe('not_found');
        });
    });

    it('groups published listings of DIFFERENT owners and skips excepted ones', async () => {
        await withTestTransaction(async (tx) => {
            const owner = await seedOwner(tx);
            const other = await seedOwner(tx);
            const dest = await seedDestination(tx, owner.id);
            // Unique keys so the shared test DB cannot add foreign groups to the assertion.
            const cross = `cross-${crypto.randomUUID()}`;
            const excepted = `excepted-${crypto.randomUUID()}`;
            await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                key: cross
            });
            await insertAccommodation(tx, {
                ownerId: other.id,
                destinationId: dest.id,
                key: cross
            });
            await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                key: excepted
            });
            await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                key: excepted,
                exception: true
            });

            const { items } = await listingLocationModel.listDuplicateGroups({
                vertical: VerticalEnum.ACCOMMODATION,
                page: 1,
                pageSize: 100,
                tx
            });
            const byKey = new Map(items.map((g) => [g.locationKey, g]));
            expect(byKey.get(cross)).toMatchObject({ ownerCount: 2, sameOwner: false });
            expect(byKey.get(cross)?.listings).toHaveLength(2);
            expect(byKey.has(excepted)).toBe(false);
        });
    });
});

describe('one-address unique index (HOS-1810)', () => {
    it('refuses a second PUBLISHED listing of one owner on one key (accommodation and venue)', async () => {
        await withTestTransaction(async (tx) => {
            const owner = await seedOwner(tx);
            const dest = await seedDestination(tx, owner.id);
            await insertAccommodation(tx, { ownerId: owner.id, destinationId: dest.id });
            await insertVenue(tx, { ownerId: owner.id, destinationId: dest.id });
            // A savepoint per attempt: a failed statement aborts the whole transaction.
            await expect(
                tx.transaction((inner) =>
                    insertAccommodation(inner, { ownerId: owner.id, destinationId: dest.id })
                )
            ).rejects.toThrow();
            await expect(
                tx.transaction((inner) =>
                    insertVenue(inner, { ownerId: owner.id, destinationId: dest.id })
                )
            ).rejects.toThrow();
        });
    });

    it('allows the same key for another owner, a draft, a deleted row or an excepted row', async () => {
        await withTestTransaction(async (tx) => {
            const owner = await seedOwner(tx);
            const other = await seedOwner(tx);
            const dest = await seedDestination(tx, owner.id);
            await insertAccommodation(tx, { ownerId: owner.id, destinationId: dest.id });
            await insertAccommodation(tx, { ownerId: other.id, destinationId: dest.id });
            await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                status: PublicationStatusEnum.DRAFT
            });
            await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                deletedAt: new Date()
            });
            await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                exception: true
            });
            await insertAccommodation(tx, { ownerId: owner.id, destinationId: dest.id, key: null });
            await insertAccommodation(tx, { ownerId: owner.id, destinationId: dest.id, key: null });
        });
    });

    it('setPublicationStatus leaves a conflicting listing unmoved instead of raising', async () => {
        await withTestTransaction(async (tx) => {
            const owner = await seedOwner(tx);
            const dest = await seedDestination(tx, owner.id);
            await insertVenue(tx, { ownerId: owner.id, destinationId: dest.id });
            const draft = await insertVenue(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                status: PublicationStatusEnum.DRAFT
            });
            const move = (listingId: string) =>
                listingPublicationModel.setPublicationStatus({
                    tx,
                    vertical: VerticalEnum.VENUE,
                    listingId,
                    from: PublicationStatusEnum.DRAFT,
                    to: PublicationStatusEnum.PUBLISHED
                });
            expect(await move(draft.id)).toBe(false);

            await listingLocationModel.setException({
                vertical: VerticalEnum.VENUE,
                id: draft.id,
                adminId: owner.id,
                reason: 'Food court',
                at: new Date(),
                tx
            });
            expect(await move(draft.id)).toBe(true);
        });
    });

    it('binds the exception to the key it was granted for', async () => {
        await withTestTransaction(async (tx) => {
            const owner = await seedOwner(tx);
            const dest = await seedDestination(tx, owner.id);
            const keyless = await insertVenue(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                key: null,
                status: PublicationStatusEnum.DRAFT
            });
            const keyed = await insertVenue(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                status: PublicationStatusEnum.DRAFT
            });
            const grant = (id: string) =>
                listingLocationModel.setException({
                    vertical: VerticalEnum.VENUE,
                    id,
                    adminId: owner.id,
                    reason: 'Food court',
                    at: new Date(),
                    tx
                });
            // A listing with no comparable address has nothing to be exempt for.
            expect(await grant(keyless.id)).toBe('no_key');
            expect(await grant(keyed.id)).toBe('granted');
            const state = await listingLocationModel.getState({
                vertical: VerticalEnum.VENUE,
                id: keyed.id,
                tx
            });
            expect(state?.hasException).toBe(true);

            // Moving the listing elsewhere ends the exemption (the stored key no longer matches).
            await tx.execute(
                sql`UPDATE venues SET location_key = 'moved|1|d' WHERE id = ${keyed.id}`
            );
            const moved = await listingLocationModel.getState({
                vertical: VerticalEnum.VENUE,
                id: keyed.id,
                tx
            });
            expect(moved?.hasException).toBe(false);
            // ...and moving back makes it exempt again.
            await tx.execute(sql`UPDATE venues SET location_key = ${KEY} WHERE id = ${keyed.id}`);
            expect(
                (
                    await listingLocationModel.getState({
                        vertical: VerticalEnum.VENUE,
                        id: keyed.id,
                        tx
                    })
                )?.hasException
            ).toBe(true);

            // Revoking clears the key too.
            expect(
                await listingLocationModel.clearException({
                    vertical: VerticalEnum.VENUE,
                    id: keyed.id,
                    tx
                })
            ).toBe(true);
            const rows = await tx.execute(
                sql`SELECT location_exception_key FROM venues WHERE id = ${keyed.id}`
            );
            expect(
                (rows.rows[0] as { location_exception_key: string | null }).location_exception_key
            ).toBeNull();
        });
    });

    it('a stale exception (granted for another key) neither exempts the row nor hides it as an occupant', async () => {
        await withTestTransaction(async (tx) => {
            const owner = await seedOwner(tx);
            const dest = await seedDestination(tx, owner.id);
            // Published on KEY with an exception that was granted for a DIFFERENT key.
            const stale = await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                exception: true,
                exceptionKey: 'granted-for-another-address'
            });
            const other = await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                status: PublicationStatusEnum.DRAFT
            });
            // The stale row still occupies the place.
            expect(await find(tx, VerticalEnum.ACCOMMODATION, owner.id, other.id)).toBe(stale.id);
            // The unique index refuses a second non-exempt published listing on KEY.
            await expect(
                tx.transaction((inner) =>
                    insertAccommodation(inner, { ownerId: owner.id, destinationId: dest.id })
                )
            ).rejects.toThrow();
            // A properly excepted one (granted for this key) is allowed next to it.
            await insertAccommodation(tx, {
                ownerId: owner.id,
                destinationId: dest.id,
                exception: true
            });
            // And the report lists the stale row's group.
            const { items } = await listingLocationModel.listDuplicateGroups({
                vertical: VerticalEnum.ACCOMMODATION,
                page: 1,
                pageSize: 100,
                tx
            });
            expect(items.some((g) => g.locationKey === KEY)).toBe(false);
        });
    });

    it('two concurrent publishes of one place: one succeeds, the other hits the unique index', async () => {
        const db = getTestDb();
        const [owner] = await db
            .insert(users)
            .values(testData.user({ role: 'HOST' }))
            .returning();
        if (!owner) throw new Error('owner');
        const [dest] = await db
            .insert(destinations)
            .values(testData.destination({ ownerId: owner.id }))
            .returning();
        if (!dest) throw new Error('destination');
        const key = `race-${crypto.randomUUID()}`;
        const a = await insertAccommodation(db, {
            ownerId: owner.id,
            destinationId: dest.id,
            key,
            status: PublicationStatusEnum.DRAFT
        });
        const b = await insertAccommodation(db, {
            ownerId: owner.id,
            destinationId: dest.id,
            key,
            status: PublicationStatusEnum.DRAFT
        });
        try {
            // Raw UPDATEs: they bypass the NOT EXISTS of setPublicationStatus, which is
            // exactly what a concurrent writer that read "no occupant" does.
            const publish = (id: string) =>
                db.execute(
                    sql`UPDATE accommodations SET publication_status = 'PUBLISHED' WHERE id = ${id}`
                );
            const results = await Promise.allSettled([publish(a.id), publish(b.id)]);
            expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
            const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
            const cause = (rejected.reason as { cause?: { code?: string; constraint?: string } })
                .cause;
            expect(cause?.code).toBe('23505');
            expect(cause?.constraint).toBe('accommodations_ownerId_locationKey_published_uniq');
        } finally {
            await db.delete(accommodations).where(eq(accommodations.ownerId, owner.id));
            await db.delete(destinations).where(eq(destinations.id, dest.id));
            await db.delete(users).where(eq(users.id, owner.id));
        }
    });
});
