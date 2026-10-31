/**
 * @fileoverview
 * Integration tests for `0132-hos1943-price-on-request-null.ts` (HOS-1943).
 *
 * Runs against the REAL integration database, which global setup builds with
 * every versioned Drizzle migration — including
 * `0183_hos1943_price_from_nullable`, without which the UPDATE could not store
 * a NULL at all. Every test opens a transaction, runs setup + `up()` +
 * assertions inside it, then throws a sentinel so no row survives.
 *
 * The rows are inserted with `session_replication_role = replica` (local to
 * the rolled-back transaction) so the owner and destination foreign keys do not
 * force this file to build a user and a destination it does not test.
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
import * as priceOnRequestNull from '../../src/data-migrations/0132-hos1943-price-on-request-null.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const OWNER_ID = 'a1943000-0000-4000-a000-000000000001';
const DESTINATION_ID = 'a1943000-0000-4000-a000-000000000002';

const ON_REQUEST_ZERO = 'a1943000-0000-4000-a000-000000000010';
const ON_REQUEST_POSITIVE = 'a1943000-0000-4000-a000-000000000011';
const PRICED = 'a1943000-0000-4000-a000-000000000012';
const PRICED_ZERO = 'a1943000-0000-4000-a000-000000000013';

/** Stub actor — this migration only touches `ctx.db`. */
const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos1943-price-on-request-null',
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
    const db = getDb();
    try {
        await db.transaction(async (tx) => {
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) {
            return;
        }
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

/** Inserts one experience with the given price pair. */
async function insertExperience(
    tx: DrizzleClient,
    {
        id,
        priceFrom,
        isPriceOnRequest
    }: { readonly id: string; readonly priceFrom: number; readonly isPriceOnRequest: boolean }
): Promise<void> {
    await tx.execute(sql`
        INSERT INTO experiences
            (id, slug, name, summary, description, type,
             price_from, price_unit, is_price_on_request,
             owner_id, destination_id, created_by_id, updated_by_id,
             publication_status, inactive_since, deadlines_version)
        VALUES
            (${id}, ${`hos1943-${id}`}, 'HOS-1943 fixture', 'Resumen', 'Descripción', 'TOUR_GUIDE',
             ${priceFrom}, 'per_group', ${isPriceOnRequest},
             ${OWNER_ID}, ${DESTINATION_ID}, ${OWNER_ID}, ${OWNER_ID},
             'DRAFT'::publication_status_enum, now(), 1)
    `);
}

/** Reads `price_from` for one experience id. */
async function readPrice(tx: DrizzleClient, id: string): Promise<number | null> {
    const result = await tx.execute(sql`SELECT price_from FROM experiences WHERE id = ${id}`);
    const row = result.rows[0] as { price_from: number | null } | undefined;
    if (!row) {
        throw new Error(`Experience ${id} not found`);
    }
    return row.price_from;
}

/** Inserts the four fixtures, after clearing any other on-request 0 row. */
async function arrangeFixtures(tx: DrizzleClient): Promise<void> {
    await tx.execute(sql`SET LOCAL session_replication_role = replica`);
    // Keep the count assertions independent of whatever the DB already holds.
    await tx.execute(
        sql`UPDATE experiences SET price_from = NULL WHERE is_price_on_request = true AND price_from = 0`
    );
    await insertExperience(tx, { id: ON_REQUEST_ZERO, priceFrom: 0, isPriceOnRequest: true });
    await insertExperience(tx, {
        id: ON_REQUEST_POSITIVE,
        priceFrom: 150000,
        isPriceOnRequest: true
    });
    await insertExperience(tx, { id: PRICED, priceFrom: 90000, isPriceOnRequest: false });
    await insertExperience(tx, { id: PRICED_ZERO, priceFrom: 0, isPriceOnRequest: false });
}

describe('HOS-1943: 0132-hos1943-price-on-request-null (integration)', () => {
    beforeAll(async () => {
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

    it('declares both columns it reads in requiresColumns (HOS-433)', () => {
        expect(priceOnRequestNull.meta.requiresColumns).toEqual([
            { table: 'experiences', column: 'price_from' },
            { table: 'experiences', column: 'is_price_on_request' }
        ]);
    });

    it('turns 0 into NULL only on price-on-request rows', async () => {
        await withRollback(async (tx) => {
            // Arrange
            await arrangeFixtures(tx);

            // Act
            const result = await priceOnRequestNull.up(buildCtx(tx));

            // Assert
            expect(result.counts?.experiencesRewritten).toBe(1);
            expect(await readPrice(tx, ON_REQUEST_ZERO)).toBeNull();
            // A real number behind the flag is the only copy of it: kept.
            expect(await readPrice(tx, ON_REQUEST_POSITIVE)).toBe(150000);
            // Rows without the flag are not this migration's business.
            expect(await readPrice(tx, PRICED)).toBe(90000);
            expect(await readPrice(tx, PRICED_ZERO)).toBe(0);
        });
    });

    it('is idempotent: a second run rewrites nothing', async () => {
        await withRollback(async (tx) => {
            // Arrange
            await arrangeFixtures(tx);
            await priceOnRequestNull.up(buildCtx(tx));

            // Act
            const second = await priceOnRequestNull.up(buildCtx(tx));

            // Assert
            expect(second.counts?.experiencesRewritten).toBe(0);
            expect(await readPrice(tx, ON_REQUEST_ZERO)).toBeNull();
        });
    });
});
