/**
 * @fileoverview
 * Integration tests for `0154-hos-2060-retire-policy-catalog-rows` (HOS-2060).
 *
 * Runs against the REAL integration database with the rollback-isolation idiom
 * (every test throws a sentinel at the end of its transaction): what has to be
 * proven is SQL. The relation rows of a retired row disappear, the catalog row
 * is soft-deleted with the actor stamped, an unrelated row is untouched, and a
 * second run changes nothing.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import {
    accommodations,
    amenities,
    destinations,
    eq,
    features,
    getDb,
    initializeDb,
    rAccommodationAmenity,
    rAccommodationFeature,
    resetDb,
    users
} from '@repo/db';
import {
    AccommodationTypeEnum,
    DestinationTypeEnum,
    PublicationStatusEnum,
    RoleEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0154-hos-2060-retire-policy-catalog-rows.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const PREFIX = 'zzz-test-hos2060r-';

/** Sentinel thrown at the end of every isolated test to force a rollback. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

let pool: Pool;

/** Runs `fn` inside a transaction that ALWAYS rolls back. */
async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    try {
        await getDb().transaction(async (tx) => {
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) return;
        throw error;
    }
}

/** Builds the migration ctx against a transaction-scoped client. */
function buildCtx(tx: DrizzleClient, actorId: string): SeedMigrationCtx {
    const actor: Actor = { id: actorId, roles: [RoleEnum.SUPER_ADMIN], permissions: [] };
    return { db: tx, actor, models: {}, services: {}, helpers: {} } as unknown as SeedMigrationCtx;
}

/** Returns the live amenity `slug`, creating it when the database lacks it. */
async function ensureAmenity(tx: DrizzleClient, slug: string): Promise<string> {
    const [found] = await tx
        .select({ id: amenities.id })
        .from(amenities)
        .where(eq(amenities.slug, slug));
    if (found) return found.id;
    const [row] = await tx
        .insert(amenities)
        .values({ slug, type: 'SERVICES' } as typeof amenities.$inferInsert)
        .returning({ id: amenities.id });
    if (!row) throw new Error(`Failed to insert amenity ${slug}`);
    return row.id;
}

/** Returns the live feature `slug`, creating it when the database lacks it. */
async function ensureFeature(tx: DrizzleClient, slug: string): Promise<string> {
    const [found] = await tx
        .select({ id: features.id })
        .from(features)
        .where(eq(features.slug, slug));
    if (found) return found.id;
    const [row] = await tx
        .insert(features)
        .values({ slug, category: 'AUDIENCE' } as typeof features.$inferInsert)
        .returning({ id: features.id });
    if (!row) throw new Error(`Failed to insert feature ${slug}`);
    return row.id;
}

/** Inserts an owner, a destination and one published accommodation. */
async function insertListing(
    tx: DrizzleClient
): Promise<{ readonly ownerId: string; readonly listingId: string }> {
    const suffix = crypto.randomUUID().slice(0, 8);
    const [owner] = await tx
        .insert(users)
        .values({ email: `${PREFIX}owner-${suffix}@example.test` })
        .returning({ id: users.id });
    if (!owner) throw new Error('Failed to insert owner');
    const [destination] = await tx
        .insert(destinations)
        .values({
            destinationType: DestinationTypeEnum.CITY,
            path: `${PREFIX}${suffix}`,
            slug: `${PREFIX}destination-${suffix}`,
            name: 'HOS-2060 destination',
            summary: 'HOS-2060 fixture destination.',
            description: 'HOS-2060 fixture destination, rolled back after the test.',
            location: { country: 'AR', state: 'Entre Rios', city: 'Concepcion del Uruguay' }
        } as typeof destinations.$inferInsert)
        .returning({ id: destinations.id });
    if (!destination) throw new Error('Failed to insert destination');
    const [listing] = await tx
        .insert(accommodations)
        .values({
            slug: `${PREFIX}listing-${suffix}`,
            name: 'HOS-2060 listing',
            summary: 'HOS-2060 fixture.',
            description: 'HOS-2060 fixture accommodation, rolled back after the test.',
            type: AccommodationTypeEnum.CABIN,
            ownerId: owner.id,
            destinationId: destination.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            inactiveSince: new Date(),
            deadlinesVersion: 1
        } as typeof accommodations.$inferInsert)
        .returning({ id: accommodations.id });
    if (!listing) throw new Error('Failed to insert accommodation');
    return { ownerId: owner.id, listingId: listing.id };
}

describe('HOS-2060: 0154-hos-2060-retire-policy-catalog-rows (integration)', () => {
    beforeAll(() => {
        if (!process.env.HOSPEDA_DATABASE_URL) {
            throw new Error('HOSPEDA_DATABASE_URL is not set in this worktree');
        }
        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('removes the links of every retired row, soft-deletes it, and keeps the rest', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const { ownerId, listingId } = await insertListing(tx);
            const pets = await ensureAmenity(tx, 'pet_friendly');
            const wifi = await ensureAmenity(tx, 'wifi');
            const smokingArea = await ensureFeature(tx, 'smoking_area');
            await tx.insert(rAccommodationAmenity).values([
                { accommodationId: listingId, amenityId: pets },
                { accommodationId: listingId, amenityId: wifi }
            ]);
            await tx
                .insert(rAccommodationFeature)
                .values({ accommodationId: listingId, featureId: smokingArea });

            // Act
            const result = await migration.up(buildCtx(tx, ownerId));

            // Assert
            const amenityLinks = await tx
                .select({ amenityId: rAccommodationAmenity.amenityId })
                .from(rAccommodationAmenity)
                .where(eq(rAccommodationAmenity.accommodationId, listingId));
            expect(amenityLinks.map((row) => row.amenityId)).toEqual([wifi]);
            const featureLinks = await tx
                .select({ featureId: rAccommodationFeature.featureId })
                .from(rAccommodationFeature)
                .where(eq(rAccommodationFeature.accommodationId, listingId));
            expect(featureLinks).toEqual([]);
            const [petsRow] = await tx
                .select({ deletedAt: amenities.deletedAt, deletedById: amenities.deletedById })
                .from(amenities)
                .where(eq(amenities.id, pets));
            expect(petsRow?.deletedAt).toBeInstanceOf(Date);
            expect(petsRow?.deletedById).toBe(ownerId);
            const [wifiRow] = await tx
                .select({ deletedAt: amenities.deletedAt })
                .from(amenities)
                .where(eq(amenities.id, wifi));
            expect(wifiRow?.deletedAt).toBeNull();
            expect(result.counts?.linksRemoved).toBeGreaterThanOrEqual(2);
            expect(result.counts?.rowsRetired).toBeGreaterThanOrEqual(2);
        });
    });

    it('changes nothing on a second run', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const { ownerId } = await insertListing(tx);
            const cards = await ensureAmenity(tx, 'accepts_cards');
            await migration.up(buildCtx(tx, ownerId));

            // Act
            const second = await migration.up(buildCtx(tx, ownerId));

            // Assert
            expect(second.counts?.rowsRetired).toBe(0);
            expect(second.counts?.linksRemoved).toBe(0);
            expect(second.counts?.rowsSkipped).toBe(
                migration.RETIRED_POLICY_AMENITY_SLUGS.length +
                    migration.RETIRED_POLICY_FEATURE_SLUGS.length
            );
            const [cardsRow] = await tx
                .select({ deletedAt: amenities.deletedAt })
                .from(amenities)
                .where(eq(amenities.id, cards));
            expect(cardsRow?.deletedAt).toBeInstanceOf(Date);
        });
    });
});
