/**
 * Integration test: AccommodationCalendarSyncModel (HOS-157 Phase 2 DB
 * foundation — Google Calendar sync connection table).
 *
 * Coverage:
 *   1. `upsertConnection` is idempotent on `(accommodationId, provider)` —
 *      a re-connect overwrites tokens/calendar id in place instead of
 *      erroring on the unique index or creating a duplicate row, and resets
 *      sync state (`syncToken=null`, `lastSyncStatus=PENDING`,
 *      `lastErrorMessage=null`, `isActive=true`).
 *   2. `updateSyncState` updates sync-state columns without touching any
 *      token column.
 *   3. `updateTokens` updates token columns without touching sync-state
 *      columns.
 *   4. `deactivate` sets `isActive=false` and keeps the row (audit trail);
 *      `findAllActiveByProvider` no longer returns it afterwards.
 *   5. `deleteConnection` hard-deletes the row entirely.
 *   6. `findAllActiveByProvider` only returns active rows for the requested
 *      provider.
 */
import { CalendarSyncStatusEnum, OccupancySourceEnum } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationCalendarSyncModel } from '../../src/models/accommodation/accommodationCalendarSync.model.ts';
import { accommodations, destinations, users } from '../../src/schemas/index.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

/** Inserts a minimal owner + destination + accommodation fixture and returns their ids. */
async function seedAccommodation(tx: DrizzleClient, slugSuffix: string) {
    const ownerPayload = testData.user({ role: 'HOST' });
    const [owner] = await tx.insert(users).values(ownerPayload).returning();
    if (!owner) throw new Error('Failed to insert owner');

    const destinationPayload = testData.destination({ ownerId: owner.id });
    const [destination] = await tx.insert(destinations).values(destinationPayload).returning();
    if (!destination) throw new Error('Failed to insert destination');

    const uid = crypto.randomUUID().slice(0, 8);
    const [accommodation] = await tx
        .insert(accommodations)
        .values({
            ownerId: owner.id,
            destinationId: destination.id,
            slug: `hos157-cal-sync-${slugSuffix}-${uid}`,
            name: 'HOS-157 Calendar Sync Test',
            summary: 'Regression test for the AccommodationCalendarSyncModel.',
            type: 'HOUSE',
            description: 'Accommodation inserted for the HOS-157 calendar sync model test.',
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!accommodation) throw new Error('Failed to insert accommodation');

    return { owner, destination, accommodation };
}

describe('AccommodationCalendarSyncModel (HOS-157 Phase 2)', () => {
    it('upsertConnection creates a new row on first connect', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'create');
            const model = new AccommodationCalendarSyncModel();

            const row = await model.upsertConnection(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalCalendarId: 'primary',
                    accessTokenCiphertext: 'ciphertext-1',
                    accessTokenIv: 'iv-1',
                    accessTokenAuthTag: 'authtag-1',
                    createdById: owner.id
                },
                tx
            );

            expect(row.accommodationId).toBe(accommodation.id);
            expect(row.provider).toBe(OccupancySourceEnum.GOOGLE_CALENDAR);
            expect(row.externalCalendarId).toBe('primary');
            expect(row.lastSyncStatus).toBe('PENDING');
            expect(row.isActive).toBe(true);
            expect(row.accessTokenCiphertext).toBe('ciphertext-1');
        });
    });

    it('upsertConnection is idempotent — a reconnect overwrites tokens and resets sync state', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'reconnect');
            const model = new AccommodationCalendarSyncModel();

            const first = await model.upsertConnection(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalCalendarId: 'primary',
                    accessTokenCiphertext: 'ciphertext-old',
                    accessTokenIv: 'iv-old',
                    accessTokenAuthTag: 'authtag-old',
                    createdById: owner.id
                },
                tx
            );

            // Simulate a completed sync run before the reconnect.
            await model.updateSyncState(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    syncToken: 'sync-token-before-reconnect',
                    lastSyncAt: new Date(),
                    lastSyncStatus: CalendarSyncStatusEnum.OK
                },
                tx
            );

            const reconnected = await model.upsertConnection(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalCalendarId: 'secondary',
                    accessTokenCiphertext: 'ciphertext-new',
                    accessTokenIv: 'iv-new',
                    accessTokenAuthTag: 'authtag-new',
                    createdById: owner.id
                },
                tx
            );

            // Same row (same id) — not a duplicate.
            expect(reconnected.id).toBe(first.id);
            expect(reconnected.externalCalendarId).toBe('secondary');
            expect(reconnected.accessTokenCiphertext).toBe('ciphertext-new');
            // Reconnecting resets sync state.
            expect(reconnected.syncToken).toBeNull();
            expect(reconnected.lastSyncStatus).toBe('PENDING');
            expect(reconnected.lastErrorMessage).toBeNull();
            expect(reconnected.isActive).toBe(true);

            const found = await model.findByAccommodationAndProvider(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR
                },
                tx
            );
            expect(found?.id).toBe(first.id);
        });
    });

    it('updateSyncState updates sync columns without touching token columns', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'sync-state');
            const model = new AccommodationCalendarSyncModel();

            await model.upsertConnection(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    accessTokenCiphertext: 'ciphertext-stable',
                    accessTokenIv: 'iv-stable',
                    accessTokenAuthTag: 'authtag-stable',
                    createdById: owner.id
                },
                tx
            );

            const syncedAt = new Date('2027-02-01T12:00:00Z');
            const updated = await model.updateSyncState(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    syncToken: 'next-sync-token',
                    lastSyncAt: syncedAt,
                    lastSyncStatus: CalendarSyncStatusEnum.OK
                },
                tx
            );

            expect(updated?.syncToken).toBe('next-sync-token');
            expect(updated?.lastSyncStatus).toBe('OK');
            expect(updated?.lastSyncAt?.toISOString()).toBe(syncedAt.toISOString());
            // Token columns untouched.
            expect(updated?.accessTokenCiphertext).toBe('ciphertext-stable');
            expect(updated?.accessTokenIv).toBe('iv-stable');
            expect(updated?.accessTokenAuthTag).toBe('authtag-stable');
        });
    });

    it('updateTokens updates token columns without touching sync-state columns', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'update-tokens');
            const model = new AccommodationCalendarSyncModel();

            await model.upsertConnection(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    accessTokenCiphertext: 'ciphertext-a',
                    accessTokenIv: 'iv-a',
                    accessTokenAuthTag: 'authtag-a',
                    createdById: owner.id
                },
                tx
            );

            await model.updateSyncState(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    syncToken: 'stable-sync-token',
                    lastSyncAt: new Date('2027-02-01T00:00:00Z'),
                    lastSyncStatus: CalendarSyncStatusEnum.OK
                },
                tx
            );

            await model.updateTokens(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    accessTokenCiphertext: 'ciphertext-b',
                    accessTokenIv: 'iv-b',
                    accessTokenAuthTag: 'authtag-b'
                },
                tx
            );

            const found = await model.findByAccommodationAndProvider(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR
                },
                tx
            );

            expect(found?.accessTokenCiphertext).toBe('ciphertext-b');
            expect(found?.accessTokenIv).toBe('iv-b');
            expect(found?.accessTokenAuthTag).toBe('authtag-b');
            // Sync-state columns untouched.
            expect(found?.syncToken).toBe('stable-sync-token');
            expect(found?.lastSyncStatus).toBe('OK');
        });
    });

    it('deactivate sets isActive=false and keeps the row; findAllActiveByProvider excludes it', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'deactivate');
            const model = new AccommodationCalendarSyncModel();

            await model.upsertConnection(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    accessTokenCiphertext: 'ciphertext-c',
                    accessTokenIv: 'iv-c',
                    accessTokenAuthTag: 'authtag-c',
                    createdById: owner.id
                },
                tx
            );

            const deactivated = await model.deactivate(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR
                },
                tx
            );
            expect(deactivated?.isActive).toBe(false);

            // Row still exists (audit trail) — just not active.
            const found = await model.findByAccommodationAndProvider(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR
                },
                tx
            );
            expect(found).not.toBeNull();
            expect(found?.isActive).toBe(false);

            const active = await model.findAllActiveByProvider(
                { provider: OccupancySourceEnum.GOOGLE_CALENDAR },
                tx
            );
            expect(active.map((row) => row.accommodationId)).not.toContain(accommodation.id);
        });
    });

    it('deleteConnection hard-deletes the row entirely', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'delete');
            const model = new AccommodationCalendarSyncModel();

            await model.upsertConnection(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    accessTokenCiphertext: 'ciphertext-d',
                    accessTokenIv: 'iv-d',
                    accessTokenAuthTag: 'authtag-d',
                    createdById: owner.id
                },
                tx
            );

            const deletedCount = await model.deleteConnection(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR
                },
                tx
            );
            expect(deletedCount).toBe(1);

            const found = await model.findByAccommodationAndProvider(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR
                },
                tx
            );
            expect(found).toBeNull();
        });
    });

    it('findAllActiveByProvider only returns active rows for the requested provider', async () => {
        await withTestTransaction(async (tx) => {
            const { owner: ownerA, accommodation: accommodationA } = await seedAccommodation(
                tx,
                'active-a'
            );
            const { owner: ownerB, accommodation: accommodationB } = await seedAccommodation(
                tx,
                'active-b'
            );
            const model = new AccommodationCalendarSyncModel();

            await model.upsertConnection(
                {
                    accommodationId: accommodationA.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    accessTokenCiphertext: 'ciphertext-e',
                    accessTokenIv: 'iv-e',
                    accessTokenAuthTag: 'authtag-e',
                    createdById: ownerA.id
                },
                tx
            );
            await model.upsertConnection(
                {
                    accommodationId: accommodationB.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    accessTokenCiphertext: 'ciphertext-f',
                    accessTokenIv: 'iv-f',
                    accessTokenAuthTag: 'authtag-f',
                    createdById: ownerB.id
                },
                tx
            );
            await model.deactivate(
                {
                    accommodationId: accommodationB.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR
                },
                tx
            );

            const active = await model.findAllActiveByProvider(
                { provider: OccupancySourceEnum.GOOGLE_CALENDAR },
                tx
            );
            const activeIds = active.map((row) => row.accommodationId);
            expect(activeIds).toContain(accommodationA.id);
            expect(activeIds).not.toContain(accommodationB.id);
        });
    });
});

/**
 * HOS-663 — the cron's safety net.
 *
 * `findAllActiveByProvider` is the ONLY entry point both calendar sync crons
 * iterate. A connection whose accommodation carries `deleted_at` must never
 * come back from it, independently of whether the delete-time cascade ran:
 * these are two separate defences, and this one also covers the rows that are
 * already wrong in production.
 */
describe('AccommodationCalendarSyncModel — deleted accommodations (HOS-663)', () => {
    it('findAllActiveByProvider excludes an active connection whose accommodation is soft-deleted', async () => {
        await withTestTransaction(async (tx) => {
            const { owner: liveOwner, accommodation: liveAccommodation } = await seedAccommodation(
                tx,
                'hos663-live'
            );
            const { owner: deadOwner, accommodation: deadAccommodation } = await seedAccommodation(
                tx,
                'hos663-deleted'
            );
            const model = new AccommodationCalendarSyncModel();

            for (const [accommodationId, createdById, suffix] of [
                [liveAccommodation.id, liveOwner.id, 'live'],
                [deadAccommodation.id, deadOwner.id, 'dead']
            ] as const) {
                await model.upsertConnection(
                    {
                        accommodationId,
                        provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                        accessTokenCiphertext: `ciphertext-hos663-${suffix}`,
                        accessTokenIv: `iv-hos663-${suffix}`,
                        accessTokenAuthTag: `authtag-hos663-${suffix}`,
                        createdById
                    },
                    tx
                );
            }

            // Soft-delete ONE of the two accommodations, leaving its
            // connection row untouched and still `is_active = true` — exactly
            // the production state F-65 measured.
            await tx
                .update(accommodations)
                .set({ deletedAt: new Date(), deletedById: deadOwner.id })
                .where(eq(accommodations.id, deadAccommodation.id));

            const stillActiveRow = await model.findByAccommodationAndProvider(
                {
                    accommodationId: deadAccommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR
                },
                tx
            );
            expect(stillActiveRow?.isActive).toBe(true);

            const active = await model.findAllActiveByProvider(
                { provider: OccupancySourceEnum.GOOGLE_CALENDAR },
                tx
            );
            const activeIds = active.map((row) => row.accommodationId);

            expect(activeIds).toContain(liveAccommodation.id);
            expect(activeIds).not.toContain(deadAccommodation.id);
        });
    });

    it('findAllActiveByProvider excludes soft-deleted accommodations for iCal providers too', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'hos663-ical');
            const model = new AccommodationCalendarSyncModel();

            await model.upsertConnection(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.AIRBNB,
                    accessTokenCiphertext: 'ciphertext-hos663-airbnb',
                    accessTokenIv: 'iv-hos663-airbnb',
                    accessTokenAuthTag: 'authtag-hos663-airbnb',
                    createdById: owner.id
                },
                tx
            );

            const beforeDelete = await model.findAllActiveByProvider(
                { provider: OccupancySourceEnum.AIRBNB },
                tx
            );
            expect(beforeDelete.map((row) => row.accommodationId)).toContain(accommodation.id);

            await tx
                .update(accommodations)
                .set({ deletedAt: new Date(), deletedById: owner.id })
                .where(eq(accommodations.id, accommodation.id));

            const afterDelete = await model.findAllActiveByProvider(
                { provider: OccupancySourceEnum.AIRBNB },
                tx
            );
            expect(afterDelete.map((row) => row.accommodationId)).not.toContain(accommodation.id);
        });
    });

    it('deactivateAllByAccommodation deactivates every provider and returns only the rows it changed', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'hos663-cascade');
            const { owner: otherOwner, accommodation: otherAccommodation } =
                await seedAccommodation(tx, 'hos663-untouched');
            const model = new AccommodationCalendarSyncModel();

            for (const provider of [
                OccupancySourceEnum.GOOGLE_CALENDAR,
                OccupancySourceEnum.AIRBNB,
                OccupancySourceEnum.BOOKING
            ]) {
                await model.upsertConnection(
                    {
                        accommodationId: accommodation.id,
                        provider,
                        accessTokenCiphertext: `ciphertext-${provider}`,
                        accessTokenIv: `iv-${provider}`,
                        accessTokenAuthTag: `authtag-${provider}`,
                        createdById: owner.id
                    },
                    tx
                );
            }
            // Already inactive before the cascade — this call did not change
            // it, so it must not appear in the RETURNING set.
            //
            // It does NOT follow that it needs no revocation: the only route
            // that deactivates without deleting the accommodation is the
            // host-initiated disconnect, which revokes nothing. The revocation
            // set is `findAllByAccommodation`, asserted separately below.
            await model.deactivate(
                { accommodationId: accommodation.id, provider: OccupancySourceEnum.BOOKING },
                tx
            );

            // A different accommodation's connection must survive untouched.
            await model.upsertConnection(
                {
                    accommodationId: otherAccommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    accessTokenCiphertext: 'ciphertext-other',
                    accessTokenIv: 'iv-other',
                    accessTokenAuthTag: 'authtag-other',
                    createdById: otherOwner.id
                },
                tx
            );

            const changed = await model.deactivateAllByAccommodation(
                { accommodationId: accommodation.id },
                tx
            );

            expect(changed.map((row) => row.provider).sort()).toEqual(
                [OccupancySourceEnum.AIRBNB, OccupancySourceEnum.GOOGLE_CALENDAR].sort()
            );
            expect(changed.every((row) => row.isActive === false)).toBe(true);

            for (const provider of [
                OccupancySourceEnum.GOOGLE_CALENDAR,
                OccupancySourceEnum.AIRBNB,
                OccupancySourceEnum.BOOKING
            ]) {
                const row = await model.findByAccommodationAndProvider(
                    { accommodationId: accommodation.id, provider },
                    tx
                );
                expect(row).not.toBeNull();
                expect(row?.isActive).toBe(false);
            }

            const untouched = await model.findByAccommodationAndProvider(
                {
                    accommodationId: otherAccommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR
                },
                tx
            );
            expect(untouched?.isActive).toBe(true);

            // Idempotent: a second run has nothing left to change.
            const secondRun = await model.deactivateAllByAccommodation(
                { accommodationId: accommodation.id },
                tx
            );
            expect(secondRun).toEqual([]);

            // ...and the set to REVOKE is wider than the set just changed: all
            // three providers, including the one disconnected beforehand.
            const toRevoke = await model.findAllByAccommodation(
                { accommodationId: accommodation.id },
                tx
            );
            expect(toRevoke.map((row) => row.provider).sort()).toEqual(
                [
                    OccupancySourceEnum.AIRBNB,
                    OccupancySourceEnum.BOOKING,
                    OccupancySourceEnum.GOOGLE_CALENDAR
                ].sort()
            );
        });
    });

    it('findAllByAccommodation returns INACTIVE rows — the ones the disconnect route left unrevoked', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'hos663-inactive');
            const { owner: otherOwner, accommodation: otherAccommodation } =
                await seedAccommodation(tx, 'hos663-other');
            const model = new AccommodationCalendarSyncModel();

            await model.upsertConnection(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR,
                    accessTokenCiphertext: 'ciphertext-inactive',
                    accessTokenIv: 'iv-inactive',
                    accessTokenAuthTag: 'authtag-inactive',
                    createdById: owner.id
                },
                tx
            );
            // The host pressed "Disconnect": `is_active = false`, tokens still
            // stored, grant still live at the provider.
            await model.deactivate(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.GOOGLE_CALENDAR
                },
                tx
            );

            // Another accommodation's connection must not bleed in.
            await model.upsertConnection(
                {
                    accommodationId: otherAccommodation.id,
                    provider: OccupancySourceEnum.AIRBNB,
                    accessTokenCiphertext: 'ciphertext-neighbour',
                    accessTokenIv: 'iv-neighbour',
                    accessTokenAuthTag: 'authtag-neighbour',
                    createdById: otherOwner.id
                },
                tx
            );

            const rows = await model.findAllByAccommodation(
                { accommodationId: accommodation.id },
                tx
            );

            expect(rows).toHaveLength(1);
            expect(rows[0]?.isActive).toBe(false);
            expect(rows[0]?.provider).toBe(OccupancySourceEnum.GOOGLE_CALENDAR);
            // The credential is still on the row — which is exactly why this
            // row still needs revoking.
            expect(rows[0]?.accessTokenCiphertext).toBe('ciphertext-inactive');
            expect(rows.map((row) => row.accommodationId)).not.toContain(otherAccommodation.id);
        });
    });

    it('markRevocationFailed records the failure WITHOUT touching last_sync_at', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'hos663-stamp');
            const model = new AccommodationCalendarSyncModel();

            await model.upsertConnection(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.AIRBNB,
                    accessTokenCiphertext: 'ciphertext-stamp',
                    accessTokenIv: 'iv-stamp',
                    accessTokenAuthTag: 'authtag-stamp',
                    createdById: owner.id
                },
                tx
            );

            // A real sync happened at a known moment.
            const syncedAt = new Date('2026-03-01T06:00:00.000Z');
            await model.updateSyncState(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.AIRBNB,
                    lastSyncAt: syncedAt,
                    lastSyncStatus: CalendarSyncStatusEnum.OK,
                    lastErrorMessage: null
                },
                tx
            );

            const stamped = await model.markRevocationFailed(
                {
                    accommodationId: accommodation.id,
                    provider: OccupancySourceEnum.AIRBNB,
                    errorMessage: 'HOS-663 REVOCATION_FAILED: no revocation endpoint'
                },
                tx
            );

            expect(stamped?.lastSyncStatus).toBe(CalendarSyncStatusEnum.ERROR);
            expect(stamped?.lastErrorMessage).toContain('REVOCATION_FAILED');
            // A revocation is not a sync. `last_sync_at` is one of the columns
            // the forensic query that FOUND HOS-663 leaned on; moving it would
            // claim the connection was read at a moment it was not.
            expect(stamped?.lastSyncAt?.toISOString()).toBe(syncedAt.toISOString());
            // The credential columns are untouched.
            expect(stamped?.accessTokenCiphertext).toBe('ciphertext-stamp');
        });
    });
});
