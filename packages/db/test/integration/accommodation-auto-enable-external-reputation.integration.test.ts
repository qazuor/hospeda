/**
 * Integration tests for
 * `AccommodationModel.autoEnableExternalReputationIfUndecided`.
 *
 * The primitive is a single conditional UPDATE: it must enable only an
 * undecided, currently-off, non-deleted accommodation, and every other writer
 * must observe `{ enabled: false }` without changing the row.
 *
 * Each test runs inside `withTestTransaction` so everything rolls back.
 */
import { PublicationStatusEnum } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, getTestDb, testData, withTestTransaction } from './helpers.ts';

beforeAll(() => {
    setDb(getTestDb());
});

afterAll(async () => {
    await closeTestPool();
});

/**
 * Inserts an owner, a destination and one accommodation, returning the
 * accommodation row. Overrides let each case set the toggle/audit/deleted
 * columns under test.
 */
async function seedAccommodation(
    tx: DrizzleClient,
    overrides: Partial<typeof accommodations.$inferInsert> = {}
) {
    const [owner] = await tx.insert(users).values(testData.user()).returning();
    if (!owner) throw new Error('Failed to insert owner');

    const [destination] = await tx
        .insert(destinations)
        .values(testData.destination({ ownerId: owner.id }))
        .returning();
    if (!destination) throw new Error('Failed to insert destination');

    const uid = crypto.randomUUID().slice(0, 8);
    const [accommodation] = await tx
        .insert(accommodations)
        .values({
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            inactiveSince: new Date(),
            deadlinesVersion: 1,
            ownerId: owner.id,
            destinationId: destination.id,
            slug: `auto-enable-${uid}`,
            name: 'Auto enable reputation test',
            summary: 'Integration fixture for the auto-enable primitive.',
            type: 'HOTEL',
            description: 'Accommodation inserted for the auto-enable integration test.',
            ...overrides
        })
        .returning();
    if (!accommodation) throw new Error('Failed to insert accommodation');

    return accommodation;
}

describe('AccommodationModel.autoEnableExternalReputationIfUndecided', () => {
    const model = new AccommodationModel();

    it('enables an undecided, currently-off accommodation and stamps both audit columns', async () => {
        await withTestTransaction(async (tx) => {
            const accommodation = await seedAccommodation(tx);

            const result = await model.autoEnableExternalReputationIfUndecided(
                { id: accommodation.id },
                tx
            );

            expect(result).toEqual({ enabled: true });

            const [updated] = await tx
                .select({
                    showExternalReputation: accommodations.showExternalReputation,
                    toggleDecidedAt: accommodations.externalReputationToggleDecidedAt,
                    autoEnabledAt: accommodations.externalReputationAutoEnabledAt
                })
                .from(accommodations)
                .where(eq(accommodations.id, accommodation.id));

            expect(updated?.showExternalReputation).toBe(true);
            expect(updated?.toggleDecidedAt).toBeInstanceOf(Date);
            expect(updated?.autoEnabledAt).toBeInstanceOf(Date);
            expect(updated?.toggleDecidedAt?.getTime()).toBe(updated?.autoEnabledAt?.getTime());
        });
    });

    it('does nothing when a manual decision was already recorded', async () => {
        await withTestTransaction(async (tx) => {
            const decidedAt = new Date('2026-01-01T00:00:00Z');
            const accommodation = await seedAccommodation(tx, {
                externalReputationToggleDecidedAt: decidedAt
            });

            const result = await model.autoEnableExternalReputationIfUndecided(
                { id: accommodation.id },
                tx
            );

            expect(result).toEqual({ enabled: false });

            const [row] = await tx
                .select({
                    showExternalReputation: accommodations.showExternalReputation,
                    toggleDecidedAt: accommodations.externalReputationToggleDecidedAt,
                    autoEnabledAt: accommodations.externalReputationAutoEnabledAt
                })
                .from(accommodations)
                .where(eq(accommodations.id, accommodation.id));

            expect(row?.showExternalReputation).toBe(false);
            expect(row?.toggleDecidedAt?.getTime()).toBe(decidedAt.getTime());
            expect(row?.autoEnabledAt).toBeNull();
        });
    });

    it('does nothing when the toggle is already on', async () => {
        await withTestTransaction(async (tx) => {
            const accommodation = await seedAccommodation(tx, { showExternalReputation: true });

            const result = await model.autoEnableExternalReputationIfUndecided(
                { id: accommodation.id },
                tx
            );

            expect(result).toEqual({ enabled: false });

            const [row] = await tx
                .select({
                    autoEnabledAt: accommodations.externalReputationAutoEnabledAt
                })
                .from(accommodations)
                .where(eq(accommodations.id, accommodation.id));

            expect(row?.autoEnabledAt).toBeNull();
        });
    });

    it('does nothing for a soft-deleted accommodation', async () => {
        await withTestTransaction(async (tx) => {
            const accommodation = await seedAccommodation(tx, { deletedAt: new Date() });

            const result = await model.autoEnableExternalReputationIfUndecided(
                { id: accommodation.id },
                tx
            );

            expect(result).toEqual({ enabled: false });

            const [row] = await tx
                .select({
                    showExternalReputation: accommodations.showExternalReputation,
                    autoEnabledAt: accommodations.externalReputationAutoEnabledAt
                })
                .from(accommodations)
                .where(eq(accommodations.id, accommodation.id));

            expect(row?.showExternalReputation).toBe(false);
            expect(row?.autoEnabledAt).toBeNull();
        });
    });
});
