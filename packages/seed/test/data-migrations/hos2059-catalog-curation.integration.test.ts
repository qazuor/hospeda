/**
 * @fileoverview
 * Integration tests for `0147-hos-2059-catalog-curation.ts` (HOS-2059).
 *
 * Runs against the REAL integration database (migrated, not seeded). Every
 * test opens a transaction, builds the catalog rows and relation rows it
 * needs, runs `up()`, asserts, then throws a sentinel so nothing survives.
 *
 * Relation rows point at fake accommodation/venue/experience ids: the inserts
 * run under `session_replication_role = replica` (local to the rolled-back
 * transaction), so the owner foreign keys do not force this file to build
 * full listings it does not test. The catalog rows are real.
 *
 * What this pins, beyond "it ran":
 * - no owner loses an item: every relation on a retired row reappears on the
 *   survivor, in the right table, for every vertical;
 * - a duplicate that encoded an attribute sets it (`shared_kitchen` becomes
 *   `full_kitchen` with `scope = shared`), and an owner that already linked
 *   the survivor keeps its own attributes;
 * - a same-kind move keeps the relation's attributes, a cross-kind move counts
 *   what it could not carry;
 * - the run is idempotent, and a missing survivor aborts instead of deleting.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { getDb, initializeDb, resetDb, sql } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as curation from '../../src/data-migrations/0147-hos-2059-catalog-curation.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const ACTOR_ID = 'a2059000-0000-4000-a000-000000000001';
const ACC_A = 'a2059000-0000-4000-a000-0000000000a1';
const ACC_B = 'a2059000-0000-4000-a000-0000000000b1';
const VENUE = 'a2059000-0000-4000-a000-0000000000c1';
const EXPERIENCE = 'a2059000-0000-4000-a000-0000000000d1';

const STUB_ACTOR: Actor = {
    id: ACTOR_ID,
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: []
};

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
function buildCtx(tx: DrizzleClient): SeedMigrationCtx {
    return {
        db: tx,
        actor: STUB_ACTOR,
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
}

/** Existing (pre-migration) catalog rows the curation reads or retires. */
const EXISTING_AMENITIES: readonly (readonly [string, string, string])[] = [
    // slug, type, verticals (pg array literal)
    ['river_view', 'OUTDOORS', '{accommodation}'],
    ['river_access', 'OUTDOORS', '{accommodation}'],
    ['panoramic_view', 'OUTDOORS', '{accommodation,venue,experience}'],
    ['shared_kitchen', 'KITCHEN', '{accommodation}'],
    ['shared_patio', 'OUTDOORS', '{accommodation}'],
    ['umbrella_gazebo', 'OUTDOORS', '{accommodation}'],
    ['full_kitchen', 'KITCHEN', '{accommodation}'],
    ['patio', 'OUTDOORS', '{accommodation}'],
    ['laundry_service', 'LAUNDRY', '{accommodation}'],
    ['luggage_storage', 'SERVICES', '{accommodation}'],
    ['wifi', 'CONNECTIVITY', '{accommodation,venue,experience}'],
    ['parking', 'PARKING', '{accommodation,venue,experience}'],
    ['outdoor_lighting', 'GENERAL_APPLIANCES', '{accommodation}'],
    ['wheelchair_accessible', 'ACCESSIBILITY', '{accommodation,venue,experience}'],
    ['coworking_space', 'WORK_FRIENDLY', '{accommodation}'],
    ['bbq_grill', 'OUTDOORS', '{accommodation}'],
    ['quincho', 'OUTDOORS', '{accommodation}'],
    ['hair_dryer', 'CLIMATE_CONTROL', '{accommodation}'],
    ['tv_per_room', 'CONNECTIVITY', '{accommodation}'],
    ['smart_tv', 'CONNECTIVITY', '{accommodation}'],
    ['cable_tv', 'CONNECTIVITY', '{accommodation}'],
    ['fireplace', 'OUTDOORS', '{accommodation}'],
    ['blackout_curtains', 'BED_AND_BATH', '{accommodation}'],
    ['bicycles', 'GENERAL_APPLIANCES', '{accommodation,experience}']
];

const EXISTING_FEATURES: readonly (readonly [string, string, string])[] = [
    ['laundry_service', 'OFFER_PROFILE', '{accommodation}'],
    ['luggage_storage', 'OFFER_PROFILE', '{accommodation}'],
    ['wifi_full_property', 'OFFER_PROFILE', '{accommodation}'],
    ['satellite_wifi', 'OFFER_PROFILE', '{accommodation}'],
    ['internal_parking', 'ACCESS', '{accommodation}'],
    ['perimeter_lighting', 'OFFER_PROFILE', '{accommodation}'],
    ['disability_accessible', 'AUDIENCE', '{accommodation,venue,experience}'],
    ['remote_coworking_suitable', 'AUDIENCE', '{accommodation}'],
    ['camping_sector', 'OFFER_PROFILE', '{accommodation}'],
    ['camping_area', 'OFFER_PROFILE', '{accommodation}'],
    ['private_grill', 'OFFER_PROFILE', '{accommodation}'],
    ['covered_barbecue_area', 'OFFER_PROFILE', '{accommodation}'],
    ['transfer_service', 'OFFER_PROFILE', '{accommodation}'],
    ['vehicle_rental', 'OFFER_PROFILE', '{accommodation}'],
    ['panoramic_view_extended', 'VIEW', '{accommodation}'],
    ['spa_front', 'LOCATION', '{accommodation}']
];

/** Builds a clean pre-migration catalog: the rows above, and nothing else. */
async function arrangeCatalog(tx: DrizzleClient): Promise<void> {
    await tx.execute(sql`SET LOCAL session_replication_role = replica`);
    // The integration DB is not seeded, but clear the tables so the counts
    // below cannot depend on what another suite left behind.
    await tx.execute(sql`DELETE FROM r_accommodation_amenity`);
    await tx.execute(sql`DELETE FROM r_accommodation_feature`);
    await tx.execute(sql`DELETE FROM r_venue_amenity`);
    await tx.execute(sql`DELETE FROM r_venue_feature`);
    await tx.execute(sql`DELETE FROM r_experience_amenity`);
    await tx.execute(sql`DELETE FROM r_experience_feature`);
    await tx.execute(sql`DELETE FROM amenities`);
    await tx.execute(sql`DELETE FROM features`);
    for (const [slug, type, verticals] of EXISTING_AMENITIES) {
        await tx.execute(sql`
            INSERT INTO amenities (slug, type, applicable_verticals)
            VALUES (${slug}, ${type}::amenities_type_enum, ${verticals}::text[])
        `);
    }
    for (const [slug, category, verticals] of EXISTING_FEATURES) {
        await tx.execute(sql`
            INSERT INTO features (slug, category, applicable_verticals)
            VALUES (${slug}, ${category}::feature_category_enum, ${verticals}::text[])
        `);
    }
}

/** Links an accommodation to an amenity, with optional attributes. */
async function linkAccommodationAmenity(
    tx: DrizzleClient,
    {
        accommodationId,
        slug,
        scope = null,
        availability = null,
        isOptional = false
    }: {
        readonly accommodationId: string;
        readonly slug: string;
        readonly scope?: string | null;
        readonly availability?: string | null;
        readonly isOptional?: boolean;
    }
): Promise<void> {
    await tx.execute(sql`
        INSERT INTO r_accommodation_amenity (accommodation_id, amenity_id, is_optional, scope, availability)
        SELECT ${accommodationId}, id, ${isOptional}, ${scope}::amenity_scope_enum, ${availability}::amenity_availability_enum
        FROM amenities WHERE slug = ${slug}
    `);
}

/** Links an accommodation to a feature, with optional host notes. */
async function linkAccommodationFeature(
    tx: DrizzleClient,
    {
        accommodationId,
        slug,
        comments = null
    }: {
        readonly accommodationId: string;
        readonly slug: string;
        readonly comments?: string | null;
    }
): Promise<void> {
    await tx.execute(sql`
        INSERT INTO r_accommodation_feature (accommodation_id, feature_id, comments)
        SELECT ${accommodationId}, id, ${comments} FROM features WHERE slug = ${slug}
    `);
}

/** Reads one accommodation-amenity link by slug, or undefined. */
async function readAccommodationAmenity(
    tx: DrizzleClient,
    accommodationId: string,
    slug: string
): Promise<
    { scope: string | null; availability: string | null; is_optional: boolean } | undefined
> {
    const result = await tx.execute(sql`
        SELECT r.scope, r.availability, r.is_optional
        FROM r_accommodation_amenity r JOIN amenities a ON a.id = r.amenity_id
        WHERE r.accommodation_id = ${accommodationId} AND a.slug = ${slug} AND a.deleted_at IS NULL
    `);
    return result.rows[0] as
        | { scope: string | null; availability: string | null; is_optional: boolean }
        | undefined;
}

/** Reads one accommodation-feature link by slug, or undefined. */
async function readAccommodationFeature(
    tx: DrizzleClient,
    accommodationId: string,
    slug: string
): Promise<{ comments: string | null } | undefined> {
    const result = await tx.execute(sql`
        SELECT r.comments
        FROM r_accommodation_feature r JOIN features f ON f.id = r.feature_id
        WHERE r.accommodation_id = ${accommodationId} AND f.slug = ${slug} AND f.deleted_at IS NULL
    `);
    return result.rows[0] as { comments: string | null } | undefined;
}

/** Counts the relation rows (all six tables) still pointing at retired catalog rows. */
async function countRelationsOnRetiredRows(tx: DrizzleClient): Promise<number> {
    const result = await tx.execute(sql`
        SELECT
          (SELECT count(*) FROM r_accommodation_amenity r JOIN amenities a ON a.id = r.amenity_id WHERE a.deleted_at IS NOT NULL)
        + (SELECT count(*) FROM r_venue_amenity r JOIN amenities a ON a.id = r.amenity_id WHERE a.deleted_at IS NOT NULL)
        + (SELECT count(*) FROM r_experience_amenity r JOIN amenities a ON a.id = r.amenity_id WHERE a.deleted_at IS NOT NULL)
        + (SELECT count(*) FROM r_accommodation_feature r JOIN features f ON f.id = r.feature_id WHERE f.deleted_at IS NOT NULL)
        + (SELECT count(*) FROM r_venue_feature r JOIN features f ON f.id = r.feature_id WHERE f.deleted_at IS NOT NULL)
        + (SELECT count(*) FROM r_experience_feature r JOIN features f ON f.id = r.feature_id WHERE f.deleted_at IS NOT NULL)
        AS n
    `);
    return Number((result.rows[0] as { n: string | number }).n);
}

describe('HOS-2059: 0147-hos-2059-catalog-curation (integration)', () => {
    beforeAll(() => {
        if (!process.env.HOSPEDA_DATABASE_URL) {
            throw new Error(
                'HOSPEDA_DATABASE_URL is not set — is apps/api/.env.local present in this worktree?'
            );
        }
        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('creates the new rows, retypes, renames and retires all nineteen merged rows', async () => {
        await withRollback(async (tx) => {
            // Arrange
            await arrangeCatalog(tx);

            // Act
            const result = await curation.up(buildCtx(tx));

            // Assert
            expect(result.counts?.amenitiesCreated).toBe(60);
            expect(result.counts?.featuresCreated).toBe(6);
            expect(result.counts?.amenitiesRetyped).toBe(8);
            expect(result.counts?.featuresRenamed).toBe(1);
            expect(result.counts?.rowsRetired).toBe(19);
            const retired = await tx.execute(sql`
                SELECT
                  (SELECT count(*) FROM amenities WHERE deleted_at IS NOT NULL AND deleted_by_id = ${ACTOR_ID}) AS a,
                  (SELECT count(*) FROM features WHERE deleted_at IS NOT NULL AND deleted_by_id = ${ACTOR_ID}) AS f
            `);
            const row = retired.rows[0] as { a: string; f: string };
            expect(Number(row.a)).toBe(6);
            expect(Number(row.f)).toBe(13);
            const renamed = await tx.execute(
                sql`SELECT slug FROM features WHERE slug IN ('spa_front', 'balneario_front')`
            );
            expect(renamed.rows).toEqual([{ slug: 'balneario_front' }]);
            const bikes = await tx.execute(sql`SELECT type FROM amenities WHERE slug = 'bicycles'`);
            expect(bikes.rows).toEqual([{ type: 'ENTERTAINMENT' }]);
            const widened = await tx.execute(
                sql`SELECT applicable_verticals FROM features WHERE slug = 'panoramic_view_extended'`
            );
            expect(widened.rows).toEqual([
                { applicable_verticals: ['accommodation', 'venue', 'experience'] }
            ]);
        });
    });

    it('moves every relation to the survivor, in every vertical, and leaves none behind', async () => {
        await withRollback(async (tx) => {
            // Arrange
            await arrangeCatalog(tx);
            await linkAccommodationAmenity(tx, {
                accommodationId: ACC_A,
                slug: 'river_view',
                isOptional: true
            });
            await linkAccommodationAmenity(tx, { accommodationId: ACC_A, slug: 'umbrella_gazebo' });
            await linkAccommodationFeature(tx, {
                accommodationId: ACC_A,
                slug: 'wifi_full_property'
            });
            await linkAccommodationFeature(tx, { accommodationId: ACC_A, slug: 'satellite_wifi' });
            await linkAccommodationFeature(tx, {
                accommodationId: ACC_A,
                slug: 'transfer_service'
            });
            await tx.execute(sql`
                INSERT INTO r_venue_feature (venue_id, feature_id)
                SELECT ${VENUE}, id FROM features WHERE slug = 'disability_accessible'
            `);
            await tx.execute(sql`
                INSERT INTO r_experience_amenity (experience_id, amenity_id)
                SELECT ${EXPERIENCE}, id FROM amenities WHERE slug = 'panoramic_view'
            `);

            // Act
            const result = await curation.up(buildCtx(tx));

            // Assert: amenity -> feature
            expect(await readAccommodationFeature(tx, ACC_A, 'river_view')).toBeDefined();
            // amenity -> amenity
            expect(await readAccommodationAmenity(tx, ACC_A, 'gazebo')).toBeDefined();
            // two features -> one amenity: one link, the second collapses
            expect(await readAccommodationAmenity(tx, ACC_A, 'wifi')).toBeDefined();
            // feature -> amenity with the same slug
            expect(await readAccommodationAmenity(tx, ACC_A, 'transfer_service')).toBeDefined();
            // venue feature -> venue amenity
            const venue = await tx.execute(sql`
                SELECT a.slug FROM r_venue_amenity r JOIN amenities a ON a.id = r.amenity_id
                WHERE r.venue_id = ${VENUE}
            `);
            expect(venue.rows).toEqual([{ slug: 'wheelchair_accessible' }]);
            // experience amenity -> experience feature
            const experience = await tx.execute(sql`
                SELECT f.slug FROM r_experience_feature r JOIN features f ON f.id = r.feature_id
                WHERE r.experience_id = ${EXPERIENCE}
            `);
            expect(experience.rows).toEqual([{ slug: 'panoramic_view_extended' }]);
            expect(await countRelationsOnRetiredRows(tx)).toBe(0);
            expect(result.counts?.relationsOnRetiredRows).toBe(7);
            expect(result.counts?.relationsMoved).toBe(6);
            expect(result.counts?.relationsCollapsed).toBe(1);
            // `river_view` carried is_optional, which a feature link cannot hold.
            expect(result.counts?.attributesDropped).toBe(1);
        });
    });

    it('sets the absorbed attribute, and never overwrites a link the owner already had', async () => {
        await withRollback(async (tx) => {
            // Arrange: A only has the shared kitchen; B has its own kitchen too.
            await arrangeCatalog(tx);
            await linkAccommodationAmenity(tx, { accommodationId: ACC_A, slug: 'shared_kitchen' });
            await linkAccommodationAmenity(tx, {
                accommodationId: ACC_B,
                slug: 'full_kitchen',
                scope: 'private',
                availability: 'seasonal'
            });
            await linkAccommodationAmenity(tx, { accommodationId: ACC_B, slug: 'shared_kitchen' });
            await linkAccommodationFeature(tx, { accommodationId: ACC_A, slug: 'private_grill' });
            await linkAccommodationAmenity(tx, {
                accommodationId: ACC_A,
                slug: 'shared_patio',
                availability: 'seasonal'
            });

            // Act
            await curation.up(buildCtx(tx));

            // Assert
            expect(await readAccommodationAmenity(tx, ACC_A, 'full_kitchen')).toEqual({
                scope: 'shared',
                availability: null,
                is_optional: false
            });
            expect(await readAccommodationAmenity(tx, ACC_B, 'full_kitchen')).toEqual({
                scope: 'private',
                availability: 'seasonal',
                is_optional: false
            });
            expect((await readAccommodationAmenity(tx, ACC_A, 'bbq_grill'))?.scope).toBe('private');
            // Same-kind move keeps the relation's own attributes.
            expect(await readAccommodationAmenity(tx, ACC_A, 'patio')).toEqual({
                scope: 'shared',
                availability: 'seasonal',
                is_optional: false
            });
        });
    });

    it('on a collision, fills the survivor NULL attributes and never overwrites a declared one', async () => {
        await withRollback(async (tx) => {
            // Arrange: every listing already links the survivor.
            await arrangeCatalog(tx);
            // A: patio with no scope + shared_patio -> patio gains scope=shared.
            await linkAccommodationAmenity(tx, { accommodationId: ACC_A, slug: 'patio' });
            await linkAccommodationAmenity(tx, { accommodationId: ACC_A, slug: 'shared_patio' });
            // A: bbq_grill with no scope + private_grill (feature) -> bbq_grill gains private.
            await linkAccommodationAmenity(tx, { accommodationId: ACC_A, slug: 'bbq_grill' });
            await linkAccommodationFeature(tx, { accommodationId: ACC_A, slug: 'private_grill' });
            // A: camping_area with no note + camping_sector with a note -> note filled.
            await linkAccommodationFeature(tx, { accommodationId: ACC_A, slug: 'camping_area' });
            await linkAccommodationFeature(tx, {
                accommodationId: ACC_A,
                slug: 'camping_sector',
                comments: 'Junto al arroyo'
            });
            // B: a declared private, seasonal kitchen + shared, year-round shared_kitchen
            // -> the kitchen keeps private and seasonal.
            await linkAccommodationAmenity(tx, {
                accommodationId: ACC_B,
                slug: 'full_kitchen',
                scope: 'private',
                availability: 'seasonal'
            });
            await linkAccommodationAmenity(tx, {
                accommodationId: ACC_B,
                slug: 'shared_kitchen',
                availability: 'year_round'
            });

            // Act
            const result = await curation.up(buildCtx(tx));

            // Assert: NULLs filled
            expect((await readAccommodationAmenity(tx, ACC_A, 'patio'))?.scope).toBe('shared');
            expect((await readAccommodationAmenity(tx, ACC_A, 'bbq_grill'))?.scope).toBe('private');
            expect(await readAccommodationFeature(tx, ACC_A, 'camping_area')).toEqual({
                comments: 'Junto al arroyo'
            });
            // declared values kept
            expect(await readAccommodationAmenity(tx, ACC_B, 'full_kitchen')).toEqual({
                scope: 'private',
                availability: 'seasonal',
                is_optional: false
            });
            // counters: four collapses, all carrying attributes (forced scope or
            // a note); three survivor rows changed (B's kitchen had nothing NULL
            // that the source could fill).
            expect(result.counts).toMatchObject({
                relationsOnRetiredRows: 4,
                relationsMoved: 0,
                relationsCollapsed: 4,
                relationsCollapsedWithAttributes: 4,
                survivorAttributesFilled: 3
            });
            expect(await countRelationsOnRetiredRows(tx)).toBe(0);
        });
    });

    it('keeps the host note on a feature-to-feature merge and counts it on a cross-kind one', async () => {
        await withRollback(async (tx) => {
            // Arrange
            await arrangeCatalog(tx);
            await linkAccommodationFeature(tx, {
                accommodationId: ACC_A,
                slug: 'camping_sector',
                comments: 'Junto al arroyo'
            });
            await linkAccommodationFeature(tx, {
                accommodationId: ACC_A,
                slug: 'laundry_service',
                comments: 'Con costo'
            });

            // Act
            const result = await curation.up(buildCtx(tx));

            // Assert
            expect(await readAccommodationFeature(tx, ACC_A, 'camping_area')).toEqual({
                comments: 'Junto al arroyo'
            });
            expect(await readAccommodationAmenity(tx, ACC_A, 'laundry_service')).toBeDefined();
            expect(result.counts?.attributesDropped).toBe(1);
        });
    });

    it('is idempotent: a second run creates, retires and moves nothing', async () => {
        await withRollback(async (tx) => {
            // Arrange
            await arrangeCatalog(tx);
            await linkAccommodationAmenity(tx, { accommodationId: ACC_A, slug: 'shared_kitchen' });
            await curation.up(buildCtx(tx));

            // Act
            const second = await curation.up(buildCtx(tx));

            // Assert
            expect(second.counts).toMatchObject({
                amenitiesCreated: 0,
                featuresCreated: 0,
                amenitiesRetyped: 0,
                featuresRenamed: 0,
                rowsRetired: 0,
                mergesSkipped: 19,
                relationsMoved: 0
            });
            expect((await readAccommodationAmenity(tx, ACC_A, 'full_kitchen'))?.scope).toBe(
                'shared'
            );
        });
    });

    it('aborts, deleting nothing, when a survivor is missing', async () => {
        await withRollback(async (tx) => {
            // Arrange
            await arrangeCatalog(tx);
            await tx.execute(sql`DELETE FROM amenities WHERE slug = 'full_kitchen'`);

            // Act + Assert
            await expect(curation.up(buildCtx(tx))).rejects.toThrow(/full_kitchen/);
        });
    });
});
