/**
 * @fileoverview
 * Integration tests for `0155-hos-2061-venue-experience-catalog-curation`
 * (HOS-2061).
 *
 * Runs against the REAL integration database with the rollback-isolation idiom
 * (every test throws a sentinel at the end of its transaction): what has to be
 * proven is SQL. A venue that ticked `accepts_reservations` gets
 * `policies.reservations` backfilled (and an owner-chosen value is kept), an
 * experience that ticked `private_available` gets `policies.privateGroups`,
 * the `kid_friendly` and `happy_hour` links move to their survivor, the
 * retired rows are soft-deleted, the widenings are unions, and a second run
 * changes nothing.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import {
    amenities,
    destinations,
    eq,
    experiences,
    features,
    getDb,
    initializeDb,
    rExperienceFeature,
    resetDb,
    rVenueAmenity,
    rVenueFeature,
    users,
    venues
} from '@repo/db';
import {
    DestinationTypeEnum,
    ExperienceTypeEnum,
    PublicationStatusEnum,
    RoleEnum,
    VenueTypeEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0155-hos-2061-venue-experience-catalog-curation.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const PREFIX = 'zzz-test-hos2061-';

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

/** Makes the amenity `slug` live with `verticals`, creating it when absent. */
async function ensureAmenity(
    tx: DrizzleClient,
    slug: string,
    verticals: string[]
): Promise<string> {
    const [found] = await tx
        .select({ id: amenities.id })
        .from(amenities)
        .where(eq(amenities.slug, slug));
    if (found) {
        await tx
            .update(amenities)
            .set({ deletedAt: null, applicableVerticals: verticals })
            .where(eq(amenities.id, found.id));
        return found.id;
    }
    const [row] = await tx
        .insert(amenities)
        .values({
            slug,
            type: 'SERVICES',
            applicableVerticals: verticals
        } as typeof amenities.$inferInsert)
        .returning({ id: amenities.id });
    if (!row) throw new Error(`Failed to insert amenity ${slug}`);
    return row.id;
}

/** Makes the feature `slug` live with `verticals`, creating it when absent. */
async function ensureFeature(
    tx: DrizzleClient,
    slug: string,
    verticals: string[]
): Promise<string> {
    const [found] = await tx
        .select({ id: features.id })
        .from(features)
        .where(eq(features.slug, slug));
    if (found) {
        await tx
            .update(features)
            .set({ deletedAt: null, applicableVerticals: verticals })
            .where(eq(features.id, found.id));
        return found.id;
    }
    const [row] = await tx
        .insert(features)
        .values({
            slug,
            category: 'AUDIENCE',
            applicableVerticals: verticals
        } as typeof features.$inferInsert)
        .returning({ id: features.id });
    if (!row) throw new Error(`Failed to insert feature ${slug}`);
    return row.id;
}

/** Inserts an owner, a destination, two venues and one experience. */
async function insertListings(tx: DrizzleClient): Promise<{
    readonly ownerId: string;
    readonly venueId: string;
    readonly otherVenueId: string;
    readonly experienceId: string;
}> {
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
            name: 'HOS-2061 destination',
            summary: 'HOS-2061 fixture destination.',
            description: 'HOS-2061 fixture destination, rolled back after the test.',
            location: { country: 'AR', state: 'Entre Rios', city: 'Concepcion del Uruguay' }
        } as typeof destinations.$inferInsert)
        .returning({ id: destinations.id });
    if (!destination) throw new Error('Failed to insert destination');
    const venueValues = (slug: string, policies: Record<string, unknown> | null) =>
        ({
            slug,
            name: 'HOS-2061 venue',
            summary: 'HOS-2061 fixture.',
            description: 'HOS-2061 fixture venue, rolled back after the test.',
            type: VenueTypeEnum.RESTAURANT,
            businessLines: ['food'],
            ownerId: owner.id,
            destinationId: destination.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            inactiveSince: new Date(),
            deadlinesVersion: 1,
            policies
        }) as typeof venues.$inferInsert;
    const [venue] = await tx
        .insert(venues)
        .values(venueValues(`${PREFIX}venue-${suffix}`, null))
        .returning({ id: venues.id });
    const [otherVenue] = await tx
        .insert(venues)
        .values(venueValues(`${PREFIX}venue-b-${suffix}`, { reservations: 'required' }))
        .returning({ id: venues.id });
    const [experience] = await tx
        .insert(experiences)
        .values({
            slug: `${PREFIX}experience-${suffix}`,
            name: 'HOS-2061 experience',
            summary: 'HOS-2061 fixture.',
            description: 'HOS-2061 fixture experience, rolled back after the test.',
            type: ExperienceTypeEnum.KAYAK_RENTAL,
            ownerId: owner.id,
            destinationId: destination.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            inactiveSince: new Date(),
            deadlinesVersion: 1
        } as typeof experiences.$inferInsert)
        .returning({ id: experiences.id });
    if (!venue || !otherVenue || !experience) throw new Error('Failed to insert listings');
    return {
        ownerId: owner.id,
        venueId: venue.id,
        otherVenueId: otherVenue.id,
        experienceId: experience.id
    };
}

describe('HOS-2061: 0155-hos-2061-venue-experience-catalog-curation (integration)', () => {
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

    it('backfills the policies, moves the merged links and retires the rows', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const { ownerId, venueId, otherVenueId, experienceId } = await insertListings(tx);
            const reservations = await ensureAmenity(tx, 'accepts_reservations', ['venue']);
            const happyHourAmenity = await ensureAmenity(tx, 'happy_hour', ['venue']);
            const kidFriendly = await ensureFeature(tx, 'kid_friendly', ['experience']);
            const privateAvailable = await ensureFeature(tx, 'private_available', ['experience']);
            await ensureFeature(tx, 'family_friendly', ['venue']);
            await tx.insert(rVenueAmenity).values([
                { venueId, amenityId: reservations },
                { venueId: otherVenueId, amenityId: reservations },
                { venueId, amenityId: happyHourAmenity }
            ]);
            await tx.insert(rExperienceFeature).values([
                { experienceId, featureId: kidFriendly },
                { experienceId, featureId: privateAvailable }
            ]);

            // Act
            const result = await migration.up(buildCtx(tx, ownerId));

            // Assert: policies backfilled, an owner-chosen value kept.
            const [venue] = await tx
                .select({ policies: venues.policies })
                .from(venues)
                .where(eq(venues.id, venueId));
            expect(venue?.policies).toMatchObject({ reservations: 'recommended' });
            const [otherVenue] = await tx
                .select({ policies: venues.policies })
                .from(venues)
                .where(eq(venues.id, otherVenueId));
            expect(otherVenue?.policies).toMatchObject({ reservations: 'required' });
            const [experience] = await tx
                .select({ policies: experiences.policies })
                .from(experiences)
                .where(eq(experiences.id, experienceId));
            expect(experience?.policies).toMatchObject({ privateGroups: true });

            // Assert: merged links live on the survivors.
            const [familyFriendly] = await tx
                .select({ id: features.id, verticals: features.applicableVerticals })
                .from(features)
                .where(eq(features.slug, 'family_friendly'));
            expect(familyFriendly?.verticals).toEqual(['venue', 'experience']);
            const experienceFeatureIds = (
                await tx
                    .select({ featureId: rExperienceFeature.featureId })
                    .from(rExperienceFeature)
                    .where(eq(rExperienceFeature.experienceId, experienceId))
            ).map((row) => row.featureId);
            expect(experienceFeatureIds).toEqual([familyFriendly?.id]);
            const [happyHourFeature] = await tx
                .select({ id: features.id })
                .from(features)
                .where(eq(features.slug, 'happy_hour'));
            const venueFeatureIds = (
                await tx
                    .select({ featureId: rVenueFeature.featureId })
                    .from(rVenueFeature)
                    .where(eq(rVenueFeature.venueId, venueId))
            ).map((row) => row.featureId);
            expect(venueFeatureIds).toEqual([happyHourFeature?.id]);
            const venueAmenityLinks = await tx
                .select({ amenityId: rVenueAmenity.amenityId })
                .from(rVenueAmenity)
                .where(eq(rVenueAmenity.venueId, venueId));
            expect(venueAmenityLinks).toEqual([]);

            // Assert: the four sources are soft-deleted with the actor stamped.
            for (const id of [reservations, happyHourAmenity]) {
                const [row] = await tx
                    .select({ deletedAt: amenities.deletedAt, deletedById: amenities.deletedById })
                    .from(amenities)
                    .where(eq(amenities.id, id));
                expect(row?.deletedAt).toBeInstanceOf(Date);
                expect(row?.deletedById).toBe(ownerId);
            }
            for (const id of [kidFriendly, privateAvailable]) {
                const [row] = await tx
                    .select({ deletedAt: features.deletedAt })
                    .from(features)
                    .where(eq(features.id, id));
                expect(row?.deletedAt).toBeInstanceOf(Date);
            }
            expect(result.counts?.policiesBackfilled).toBe(2);
            expect(result.counts?.rowsMerged).toBe(2);
            expect(result.counts?.policyRowsRetired).toBe(2);
        });
    });

    it('widens as a union and keeps a vertical an admin added', async () => {
        await withRollback(async (tx) => {
            const { ownerId } = await insertListings(tx);
            await ensureFeature(tx, 'river_view', ['experience', 'accommodation']);

            await migration.up(buildCtx(tx, ownerId));

            const [row] = await tx
                .select({ verticals: features.applicableVerticals })
                .from(features)
                .where(eq(features.slug, 'river_view'));
            expect(row?.verticals).toEqual(['accommodation', 'venue', 'experience']);
        });
    });

    it('changes nothing on a second run', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const { ownerId } = await insertListings(tx);
            await ensureAmenity(tx, 'accepts_reservations', ['venue']);
            await ensureFeature(tx, 'family_friendly', ['venue']);
            await ensureFeature(tx, 'kid_friendly', ['experience']);
            await migration.up(buildCtx(tx, ownerId));

            // Act
            const second = await migration.up(buildCtx(tx, ownerId));

            // Assert
            expect(second.counts).toMatchObject({
                amenitiesCreated: 0,
                featuresCreated: 0,
                rowsWidened: 0,
                descriptionsRewritten: 0,
                rowsMerged: 0,
                policyRowsRetired: 0,
                policiesBackfilled: 0,
                policyLinksRemoved: 0
            });
            expect(second.counts?.mergesSkipped).toBe(migration.CATALOG_MERGES.length);
            expect(second.counts?.policyRowsSkipped).toBe(
                migration.RETIRED_POLICY_AMENITY_SLUGS.length +
                    migration.RETIRED_POLICY_FEATURE_SLUGS.length
            );
        });
    });
});
