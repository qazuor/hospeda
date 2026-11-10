/**
 * @fileoverview
 * Integration tests for `0157-hos-2061-towels-per-vertical` (HOS-2061).
 *
 * Runs against the REAL integration database with the rollback-isolation idiom.
 * Proves the SQL: `towels_provided` is created experience-only, an experience
 * that linked `towels` ends up linking it (attributes kept), `towels` is
 * narrowed to accommodation, and a second run changes nothing.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import {
    amenities,
    destinations,
    eq,
    experiences,
    getDb,
    initializeDb,
    rExperienceAmenity,
    resetDb,
    users
} from '@repo/db';
import {
    DestinationTypeEnum,
    ExperienceTypeEnum,
    PublicationStatusEnum,
    RoleEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0157-hos-2061-towels-per-vertical.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const PREFIX = 'zzz-test-hos2061-towels-';

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

/** Inserts an owner, a destination and one experience; returns the ids. */
async function insertExperience(
    tx: DrizzleClient
): Promise<{ readonly ownerId: string; readonly experienceId: string }> {
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
    if (!experience) throw new Error('Failed to insert experience');
    return { ownerId: owner.id, experienceId: experience.id };
}

/** Makes `towels` live and widened to experience, as 0155 left it. */
async function ensureWidenedTowels(tx: DrizzleClient): Promise<string> {
    const [found] = await tx
        .select({ id: amenities.id })
        .from(amenities)
        .where(eq(amenities.slug, 'towels'));
    if (found) {
        await tx
            .update(amenities)
            .set({ deletedAt: null, applicableVerticals: ['accommodation', 'experience'] })
            .where(eq(amenities.id, found.id));
        return found.id;
    }
    const [row] = await tx
        .insert(amenities)
        .values({
            slug: 'towels',
            type: 'BED_AND_BATH',
            applicableVerticals: ['accommodation', 'experience']
        } as typeof amenities.$inferInsert)
        .returning({ id: amenities.id });
    if (!row) throw new Error('Failed to insert towels');
    return row.id;
}

/** Reads one amenity row by slug. */
async function readAmenity(tx: DrizzleClient, slug: string) {
    const [row] = await tx
        .select({
            id: amenities.id,
            type: amenities.type,
            verticals: amenities.applicableVerticals
        })
        .from(amenities)
        .where(eq(amenities.slug, slug));
    return row;
}

describe('HOS-2061: 0157-hos-2061-towels-per-vertical (integration)', () => {
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

    it('creates the experience item, moves the experience links and narrows towels', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const { ownerId, experienceId } = await insertExperience(tx);
            const towelsId = await ensureWidenedTowels(tx);
            await tx.insert(rExperienceAmenity).values({
                experienceId,
                amenityId: towelsId,
                isOptional: true
            } as typeof rExperienceAmenity.$inferInsert);

            // Act
            const result = await migration.up(buildCtx(tx, ownerId));

            // Assert
            const provided = await readAmenity(tx, 'towels_provided');
            expect(provided?.type).toBe('GENERAL_APPLIANCES');
            expect(provided?.verticals).toEqual(['experience']);
            expect((await readAmenity(tx, 'towels'))?.verticals).toEqual(['accommodation']);
            const links = await tx
                .select({
                    amenityId: rExperienceAmenity.amenityId,
                    isOptional: rExperienceAmenity.isOptional
                })
                .from(rExperienceAmenity)
                .where(eq(rExperienceAmenity.experienceId, experienceId));
            expect(links).toEqual([{ amenityId: provided?.id, isOptional: true }]);
            expect(result.counts).toMatchObject({ relationsMoved: 1, rowsNarrowed: 1 });
        });
    });

    it('changes nothing on a second run', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const { ownerId } = await insertExperience(tx);
            await ensureWidenedTowels(tx);
            await migration.up(buildCtx(tx, ownerId));

            // Act
            const second = await migration.up(buildCtx(tx, ownerId));

            // Assert
            expect(second.counts).toMatchObject({
                amenitiesCreated: 0,
                relationsMoved: 0,
                rowsNarrowed: 0
            });
        });
    });
});
