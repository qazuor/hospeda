/**
 * @fileoverview
 * Integration tests for `0182-hos-2270-owner-promotions-entity.ts` (HOS-2270, release N).
 *
 * Runs against the REAL integration database with the rollback-isolation idiom of
 * `staff-email-domain-to-com-ar.integration.test.ts`: every test does its setup, the
 * migration and its assertions inside a transaction, then throws a sentinel to roll it
 * all back. This migration IS one UPDATE with a guard on NULL, so a stubbed client
 * could only assert that a statement was written, not that the guard keeps a second
 * run from changing anything.
 *
 * Covers AC-17 (copy, owner-wide rows left alone, idempotent) and AC-18 (the runner
 * guard refuses when the source column is already gone).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import {
    AccommodationModel,
    destinations,
    getDb,
    initializeDb,
    resetDb,
    sql,
    users
} from '@repo/db';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0182-hos-2270-owner-promotions-entity.js';
import { assertRequiredColumns } from '../../src/data-migrations/columnDependencyGuard.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

class RollbackSignal extends Error {}

let pool: Pool;

/** Runs `fn` inside a transaction that ALWAYS rolls back. */
async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    try {
        await getDb().transaction(async (tx) => {
            await fn(tx as unknown as DrizzleClient);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (!(error instanceof RollbackSignal)) throw error;
    }
}

const ctxOf = (tx: DrizzleClient) =>
    ({
        db: tx,
        actor: { id: 'stub' },
        models: {},
        services: {},
        helpers: {}
    }) as unknown as SeedMigrationCtx;

/** An owner and two accommodations of theirs. */
async function fixtures(tx: DrizzleClient) {
    const ownerId = crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);
    await tx.insert(users).values({
        id: ownerId,
        email: `zzqa-h2270-${uid}@example.test`,
        displayName: 'Owner',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as never);
    const destinationId = crypto.randomUUID();
    await tx.insert(destinations).values({
        id: destinationId,
        slug: `zzqa-h2270-${uid}`,
        name: 'Dest',
        destinationType: 'CITY',
        level: 4,
        path: `/zzqa/h2270-${uid}`,
        summary: 's',
        description: 'd',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: { moderationState: 'APPROVED', url: 'https://example.test/d.jpg' }
        },
        lifecycleState: 'ACTIVE'
    } as never);
    const make = () =>
        new AccommodationModel().create(
            {
                name: `H2270 ${crypto.randomUUID()}`,
                slug: `zzqa-h2270-${crypto.randomUUID()}`,
                summary: 'summary',
                description: 'description',
                ownerId,
                destinationId,
                type: 'CABIN'
            } as never,
            tx
        );
    return { ownerId, first: await make(), second: await make() };
}

/** Inserts a promotion as the code of the PREVIOUS release wrote it: legacy column only. */
async function insertLegacy(tx: DrizzleClient, ownerId: string, accommodationId: string | null) {
    const result = await tx.execute(
        sql`INSERT INTO owner_promotions (slug, owner_id, accommodation_id, title, discount_type, discount_value, valid_from)
            VALUES (${`zzqa-${crypto.randomUUID()}`}, ${ownerId}, ${accommodationId}, 'fixture', 'percentage', 10, now())
            RETURNING id`
    );
    return String(result.rows[0]?.id);
}

async function read(tx: DrizzleClient, id: string) {
    const result = await tx.execute(
        sql`SELECT entity_type, entity_id, accommodation_id FROM owner_promotions WHERE id = ${id}`
    );
    return result.rows[0] as {
        entity_type: string;
        entity_id: string | null;
        accommodation_id: string | null;
    };
}

describe('HOS-2270: 0182-hos-2270-owner-promotions-entity (integration)', () => {
    beforeAll(() => {
        if (!process.env.HOSPEDA_DATABASE_URL) {
            throw new Error('HOSPEDA_DATABASE_URL is not set');
        }
        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('declares the three columns it depends on (AC-18) and is additive', () => {
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.destructive).toBe(false);
        expect(migration.meta.requiresColumns).toEqual([
            { table: 'owner_promotions', column: 'accommodation_id' },
            { table: 'owner_promotions', column: 'entity_type' },
            { table: 'owner_promotions', column: 'entity_id' }
        ]);
    });

    it('AC-17: copies accommodation_id into entity_id and leaves an owner-wide row with a NULL entity_id', async () => {
        await withRollback(async (tx) => {
            const { ownerId, first, second } = await fixtures(tx);
            const targeted = await insertLegacy(tx, ownerId, first.id);
            const other = await insertLegacy(tx, ownerId, second.id);
            const ownerWide = await insertLegacy(tx, ownerId, null);

            const result = await migration.up(ctxOf(tx));

            expect(await read(tx, targeted)).toEqual({
                entity_type: 'accommodation',
                entity_id: first.id,
                accommodation_id: first.id
            });
            expect((await read(tx, other)).entity_id).toBe(second.id);
            expect(await read(tx, ownerWide)).toMatchObject({
                entity_type: 'accommodation',
                entity_id: null,
                accommodation_id: null
            });
            expect(result.counts).toMatchObject({ copied: 2 });
        });
    });

    it('AC-17: running it twice changes nothing', async () => {
        await withRollback(async (tx) => {
            const { ownerId, first } = await fixtures(tx);
            await insertLegacy(tx, ownerId, first.id);
            await insertLegacy(tx, ownerId, null);

            const firstRun = await migration.up(ctxOf(tx));
            const secondRun = await migration.up(ctxOf(tx));

            expect(firstRun.counts).toMatchObject({ copied: 1 });
            expect(secondRun.counts).toMatchObject({ copied: 0 });
        });
    });

    it('never touches a promotion that already has an entity_id (a venue one, or a newer write)', async () => {
        await withRollback(async (tx) => {
            const { ownerId, first } = await fixtures(tx);
            const venueId = crypto.randomUUID();
            const venuePromotion = (
                await tx.execute(
                    sql`INSERT INTO owner_promotions (slug, owner_id, entity_type, entity_id, title, discount_type, discount_value, valid_from)
                        VALUES (${`zzqa-${crypto.randomUUID()}`}, ${ownerId}, 'venue', ${venueId}, 'fixture', 'percentage', 10, now())
                        RETURNING id`
                )
            ).rows[0]?.id as string;
            await insertLegacy(tx, ownerId, first.id);

            await migration.up(ctxOf(tx));

            expect(await read(tx, venuePromotion)).toEqual({
                entity_type: 'venue',
                entity_id: venueId,
                accommodation_id: null
            });
        });
    });

    it('AC-18: the runner guard refuses when the legacy column is already gone and rows exist', async () => {
        await withRollback(async (tx) => {
            const { ownerId, first } = await fixtures(tx);
            await insertLegacy(tx, ownerId, first.id);
            // The release N+1 (contract) migration, applied too early.
            await tx.execute(sql`ALTER TABLE owner_promotions DROP COLUMN accommodation_id`);

            await expect(assertRequiredColumns({ db: tx, meta: migration.meta })).rejects.toThrow(
                /owner_promotions\.accommodation_id/
            );
        });
    });
});
