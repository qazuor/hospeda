/**
 * @fileoverview
 * Integration tests for `0158-hos-2086-unify-family-feature` (HOS-2086).
 *
 * Runs against the REAL integration database with the rollback-isolation idiom.
 * Proves the SQL: `family_suitable` is widened to the three verticals, the venue
 * and experience links of `family_friendly` move onto it with the host's name
 * and comments, `family_friendly` is soft-deleted, and a second run changes
 * nothing.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import {
    destinations,
    eq,
    experiences,
    features,
    getDb,
    initializeDb,
    rExperienceFeature,
    resetDb,
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
import * as migration from '../../src/data-migrations/0158-hos-2086-unify-family-feature.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const PREFIX = 'zzz-test-hos2086-family-';

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

/** Inserts an owner, a destination, one venue and one experience; returns the ids. */
async function insertListings(tx: DrizzleClient): Promise<{
    readonly ownerId: string;
    readonly venueId: string;
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
            name: 'HOS-2086 destination',
            summary: 'HOS-2086 fixture destination.',
            description: 'HOS-2086 fixture destination, rolled back after the test.',
            location: { country: 'AR', state: 'Entre Rios', city: 'Concepcion del Uruguay' }
        } as typeof destinations.$inferInsert)
        .returning({ id: destinations.id });
    if (!destination) throw new Error('Failed to insert destination');
    const common = {
        summary: 'HOS-2086 fixture.',
        description: 'HOS-2086 fixture, rolled back after the test.',
        ownerId: owner.id,
        destinationId: destination.id,
        publicationStatus: PublicationStatusEnum.PUBLISHED,
        inactiveSince: new Date(),
        deadlinesVersion: 1
    };
    const [venue] = await tx
        .insert(venues)
        .values({
            ...common,
            slug: `${PREFIX}venue-${suffix}`,
            name: 'HOS-2086 venue',
            type: VenueTypeEnum.RESTAURANT,
            businessLines: ['food']
        } as typeof venues.$inferInsert)
        .returning({ id: venues.id });
    const [experience] = await tx
        .insert(experiences)
        .values({
            ...common,
            slug: `${PREFIX}experience-${suffix}`,
            name: 'HOS-2086 experience',
            type: ExperienceTypeEnum.KAYAK_RENTAL
        } as typeof experiences.$inferInsert)
        .returning({ id: experiences.id });
    if (!venue || !experience) throw new Error('Failed to insert listings');
    return { ownerId: owner.id, venueId: venue.id, experienceId: experience.id };
}

/** Makes a feature live with the given verticals, creating it when absent. */
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
    if (!row) throw new Error(`Failed to insert ${slug}`);
    return row.id;
}

describe('HOS-2086: 0158-hos-2086-unify-family-feature (integration)', () => {
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

    it('widens the survivor, moves the links with their attributes and retires the source', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const { ownerId, venueId, experienceId } = await insertListings(tx);
            const suitableId = await ensureFeature(tx, 'family_suitable', ['accommodation']);
            const friendlyId = await ensureFeature(tx, 'family_friendly', ['venue', 'experience']);
            await tx.insert(rVenueFeature).values({
                venueId,
                featureId: friendlyId,
                hostReWriteName: 'Para toda la familia',
                comments: 'Menu infantil'
            } as typeof rVenueFeature.$inferInsert);
            await tx.insert(rExperienceFeature).values({
                experienceId,
                featureId: friendlyId,
                hostReWriteName: 'Con chicos',
                comments: 'Desde 4 anios'
            } as typeof rExperienceFeature.$inferInsert);

            // Act
            const result = await migration.up(buildCtx(tx, ownerId));

            // Assert
            const [suitable] = await tx
                .select({ verticals: features.applicableVerticals })
                .from(features)
                .where(eq(features.id, suitableId));
            expect(suitable?.verticals).toEqual(['accommodation', 'venue', 'experience']);
            const [friendly] = await tx
                .select({ deletedAt: features.deletedAt, deletedById: features.deletedById })
                .from(features)
                .where(eq(features.id, friendlyId));
            expect(friendly?.deletedAt).not.toBeNull();
            expect(friendly?.deletedById).toBe(ownerId);
            const venueLinks = await tx
                .select({
                    featureId: rVenueFeature.featureId,
                    name: rVenueFeature.hostReWriteName,
                    comments: rVenueFeature.comments
                })
                .from(rVenueFeature)
                .where(eq(rVenueFeature.venueId, venueId));
            expect(venueLinks).toEqual([
                { featureId: suitableId, name: 'Para toda la familia', comments: 'Menu infantil' }
            ]);
            const experienceLinks = await tx
                .select({
                    featureId: rExperienceFeature.featureId,
                    name: rExperienceFeature.hostReWriteName,
                    comments: rExperienceFeature.comments
                })
                .from(rExperienceFeature)
                .where(eq(rExperienceFeature.experienceId, experienceId));
            expect(experienceLinks).toEqual([
                { featureId: suitableId, name: 'Con chicos', comments: 'Desde 4 anios' }
            ]);
            expect(result.counts).toMatchObject({
                rowsWidened: 1,
                rowsRetired: 1,
                relationsCollapsed: 0
            });
            expect(result.counts?.relationsMoved).toBeGreaterThanOrEqual(2);
        });
    });

    it('changes nothing on a second run', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const { ownerId } = await insertListings(tx);
            await ensureFeature(tx, 'family_suitable', ['accommodation']);
            await ensureFeature(tx, 'family_friendly', ['venue', 'experience']);
            await migration.up(buildCtx(tx, ownerId));

            // Act
            const second = await migration.up(buildCtx(tx, ownerId));

            // Assert
            expect(second.counts).toMatchObject({
                rowsWidened: 0,
                relationsMoved: 0,
                rowsRetired: 0
            });
        });
    });
});
