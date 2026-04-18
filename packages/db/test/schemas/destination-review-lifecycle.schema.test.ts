/**
 * SPEC-063 T-031 — DestinationReview lifecycle_state post-migration schema test.
 *
 * Verifies via PostgreSQL introspection that the live database schema matches
 * the expected post-migration state for `destination_reviews.lifecycle_state`:
 *   (1) column exists with UDT `lifecycle_status_enum`
 *   (2) NOT NULL constraint is set
 *   (3) default value resolves to 'ACTIVE'
 *   (4) dedicated btree index `destinationReviews_lifecycleState_idx` covers the column
 *   (5) any existing rows carry the 'ACTIVE' value (default applied on ADD COLUMN)
 *
 * Rationale for introspection (option 1) over manual SQL apply (option 2):
 * the repo uses `drizzle-kit push` rather than `drizzle-kit migrate`, and
 * packages/db/CLAUDE.md indicates numbered migrations are being phased out in
 * favour of a `manual/*.sql` sequence applied by a script. An introspection
 * test survives that refactor and captures the AC literal "new column has
 * correct NOT NULL constraint" without fighting the workflow. The rollback
 * branch of T-031 (AC "rollback drops column cleanly") is not exercised here
 * — documented as scope deferral inside state.json T-031 entry.
 */
import path from 'node:path';
import { config as envConfig } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeDb } from '../../src/client';

// Per-app env strategy (SPEC-035): HOSPEDA_DATABASE_URL lives in apps/api/.env.local.
envConfig({
    path: path.resolve(__dirname, '../../../../apps/api/.env.local')
});

const TABLE_NAME = 'destination_reviews';
const COLUMN_NAME = 'lifecycle_state';
const EXPECTED_UDT = 'lifecycle_status_enum';
const EXPECTED_INDEX = 'destinationReviews_lifecycleState_idx';

describe('DestinationReview lifecycle_state schema (SPEC-063 T-031)', () => {
    let pool: Pool;

    beforeAll(() => {
        const connectionString = process.env.HOSPEDA_DATABASE_URL;
        if (!connectionString) {
            throw new Error(
                'HOSPEDA_DATABASE_URL is not set. Please set this environment variable in .env.local for database tests.'
            );
        }
        pool = new Pool({ connectionString });
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
    });

    it('column exists on destination_reviews with the lifecycle_status_enum UDT', async () => {
        const { rows } = await pool.query(
            `SELECT column_name, udt_name, is_nullable, column_default
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = $1
               AND column_name = $2`,
            [TABLE_NAME, COLUMN_NAME]
        );

        expect(rows).toHaveLength(1);
        expect(rows[0].column_name).toBe(COLUMN_NAME);
        expect(rows[0].udt_name).toBe(EXPECTED_UDT);
    });

    it('column is declared NOT NULL', async () => {
        const { rows } = await pool.query(
            `SELECT is_nullable
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = $1
               AND column_name = $2`,
            [TABLE_NAME, COLUMN_NAME]
        );

        expect(rows[0]?.is_nullable).toBe('NO');
    });

    it("column default resolves to 'ACTIVE'", async () => {
        const { rows } = await pool.query(
            `SELECT column_default
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = $1
               AND column_name = $2`,
            [TABLE_NAME, COLUMN_NAME]
        );

        // Postgres serialises enum defaults as e.g. `'ACTIVE'::lifecycle_status_enum`.
        // We assert on the literal portion to stay resilient to whitespace/casting variants.
        expect(rows[0]?.column_default).toMatch(/'ACTIVE'/);
        expect(rows[0]?.column_default).toContain(EXPECTED_UDT);
    });

    it('dedicated btree index covers the lifecycle_state column', async () => {
        const { rows } = await pool.query(
            `SELECT indexname, indexdef
             FROM pg_indexes
             WHERE schemaname = 'public'
               AND tablename = $1
               AND indexname = $2`,
            [TABLE_NAME, EXPECTED_INDEX]
        );

        expect(rows).toHaveLength(1);
        expect(rows[0].indexdef).toContain(COLUMN_NAME);
        // btree is the default, but we assert explicitly to guard against a regression
        // that might swap to hash/gin without coverage.
        expect(rows[0].indexdef.toLowerCase()).toContain('btree');
    });

    it("all existing destination_reviews rows carry lifecycle_state = 'ACTIVE'", async () => {
        // Post ADD COLUMN with DEFAULT 'ACTIVE', pre-existing rows must be backfilled.
        // A future data migration that introduces DRAFT/ARCHIVED rows is expected to
        // happen via service-layer writes; this test asserts the migration invariant
        // only, not long-running business state. If the test becomes noisy after such
        // writes, narrow it to rows created before 2026-04-18 (migration date).
        const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE lifecycle_state = 'ACTIVE')::int AS active_count
             FROM destination_reviews`
        );

        const { total, active_count } = rows[0];
        // If table is empty this still passes (0 === 0) — invariant holds trivially.
        expect(active_count).toBe(total);
    });
});
