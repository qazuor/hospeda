/**
 * Schema Tests: events.destination_id FK column (REQ-096-02 / SPEC-096)
 *
 * Verifies the schema that originated in the (now squashed) migration 0017 and
 * now lives in `packages/db/src/migrations/0000_baseline.sql`.
 *
 * These tests introspect the live PostgreSQL database via information_schema
 * to assert that:
 *   - events.destination_id column exists with type UUID and is nullable.
 *   - The FK constraint events_destination_id_destinations_id_fk (the name
 *     Drizzle generates in the baseline) exists and references destinations.id
 *     with ON DELETE SET NULL / ON UPDATE NO ACTION behaviour.
 *   - The index events_destination_id_idx exists on events(destination_id).
 *
 * Prerequisites:
 *   - Docker running: `pnpm db:start`
 *   - A database with the migrations applied (`pnpm db:migrate`)
 *   - HOSPEDA_DATABASE_URL set in apps/api/.env.local or the shell environment
 *
 * This test never migrates the database. All tests are skipped when the
 * database is not available (CI-safe) or when it has no `events` table yet
 * (an empty, un-migrated database).
 */

import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    getIntegrationContext,
    type IntegrationContext,
    isDbAvailable
} from '../integration/helpers';

// ---------------------------------------------------------------------------
// Types for information_schema rows
// ---------------------------------------------------------------------------

interface ColumnRow {
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: string;
}

interface ConstraintRow {
    constraint_name: string;
    constraint_type: string;
    delete_rule: string;
    update_rule: string;
    unique_constraint_name: string | null;
    referenced_table: string;
}

interface IndexRow {
    indexname: string;
    tablename: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Query information_schema.columns for a specific table+column. */
async function getColumnInfo(
    ctx: IntegrationContext,
    tableName: string,
    columnName: string
): Promise<ColumnRow | undefined> {
    const rows = await ctx.db.execute<ColumnRow>(sql`
        SELECT
            column_name,
            data_type,
            udt_name,
            is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = ${tableName}
          AND column_name  = ${columnName}
    `);
    return rows.rows[0];
}

/** Query FK constraints with delete rule for a specific table+constraint. */
async function getFkConstraint(
    ctx: IntegrationContext,
    tableName: string,
    constraintName: string
): Promise<ConstraintRow | undefined> {
    const rows = await ctx.db.execute<ConstraintRow>(sql`
        SELECT
            tc.constraint_name,
            tc.constraint_type,
            rc.delete_rule,
            rc.update_rule,
            rc.unique_constraint_name,
            ccu.table_name AS referenced_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc
            ON tc.constraint_name = rc.constraint_name
           AND tc.constraint_schema = rc.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
            ON rc.unique_constraint_name = ccu.constraint_name
           AND rc.unique_constraint_schema = ccu.constraint_schema
        WHERE tc.table_schema   = 'public'
          AND tc.table_name     = ${tableName}
          AND tc.constraint_name = ${constraintName}
    `);
    return rows.rows[0];
}

/** Query pg_indexes for a specific index name. */
async function getIndexInfo(
    ctx: IntegrationContext,
    indexName: string
): Promise<IndexRow | undefined> {
    const rows = await ctx.db.execute<IndexRow>(sql`
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname  = ${indexName}
    `);
    return rows.rows[0];
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

const dbAvailable = isDbAvailable();

/** Constraint name Drizzle generates for the events -> destinations FK. */
const FK_NAME = 'events_destination_id_destinations_id_fk';

/** Reason reported when the connected database has not been migrated. */
const NOT_MIGRATED_REASON =
    'events table does not exist: database is not migrated (run `pnpm db:migrate`)';

/** Returns true when `public.events` exists in the connected database. */
async function eventsTableExists(ctx: IntegrationContext): Promise<boolean> {
    const rows = await ctx.db.execute<{ present: boolean }>(
        sql`SELECT to_regclass('public.events') IS NOT NULL AS present`
    );
    return rows.rows[0]?.present === true;
}

describe('events.destination_id FK (baseline schema)', () => {
    let ctx: IntegrationContext;
    let migrated = false;

    beforeAll(async () => {
        if (!dbAvailable) return;
        ctx = getIntegrationContext();
        migrated = await eventsTableExists(ctx);
    });

    afterAll(async () => {
        if (!dbAvailable || !ctx) return;
        await ctx.pool.end();
    });

    // -------------------------------------------------------------------------
    // Column existence + type
    // -------------------------------------------------------------------------
    describe('Column: events.destination_id', () => {
        it.skipIf(!dbAvailable)('should exist in the events table', async ({ skip }) => {
            if (!migrated) skip(NOT_MIGRATED_REASON);
            const col = await getColumnInfo(ctx, 'events', 'destination_id');
            expect(col, 'events.destination_id column was not found').toBeDefined();
        });

        it.skipIf(!dbAvailable)('should have data type uuid', async ({ skip }) => {
            if (!migrated) skip(NOT_MIGRATED_REASON);
            const col = await getColumnInfo(ctx, 'events', 'destination_id');
            expect(col).toBeDefined();
            // PostgreSQL reports UUID columns as udt_name='uuid', data_type='uuid'
            expect(col?.udt_name).toBe('uuid');
        });

        it.skipIf(!dbAvailable)('should be nullable (YES)', async ({ skip }) => {
            if (!migrated) skip(NOT_MIGRATED_REASON);
            const col = await getColumnInfo(ctx, 'events', 'destination_id');
            expect(col).toBeDefined();
            expect(col?.is_nullable).toBe('YES');
        });
    });

    // -------------------------------------------------------------------------
    // FK constraint
    // -------------------------------------------------------------------------
    describe('FK constraint: events_destination_id_destinations_id_fk', () => {
        it.skipIf(!dbAvailable)('should exist on the events table', async ({ skip }) => {
            if (!migrated) skip(NOT_MIGRATED_REASON);
            const fk = await getFkConstraint(ctx, 'events', FK_NAME);
            expect(fk, `FK constraint ${FK_NAME} was not found`).toBeDefined();
        });

        it.skipIf(!dbAvailable)('should reference the destinations table', async ({ skip }) => {
            if (!migrated) skip(NOT_MIGRATED_REASON);
            const fk = await getFkConstraint(ctx, 'events', FK_NAME);
            expect(fk).toBeDefined();
            expect(fk?.referenced_table).toBe('destinations');
        });

        it.skipIf(!dbAvailable)('should have ON DELETE SET NULL behaviour', async ({ skip }) => {
            if (!migrated) skip(NOT_MIGRATED_REASON);
            const fk = await getFkConstraint(ctx, 'events', FK_NAME);
            expect(fk).toBeDefined();
            // information_schema.referential_constraints.delete_rule reports uppercase
            expect(fk?.delete_rule).toBe('SET NULL');
        });

        it.skipIf(!dbAvailable)('should have ON UPDATE NO ACTION behaviour', async ({ skip }) => {
            if (!migrated) skip(NOT_MIGRATED_REASON);
            const fk = await getFkConstraint(ctx, 'events', FK_NAME);
            expect(fk).toBeDefined();
            expect(fk?.update_rule).toBe('NO ACTION');
        });
    });

    // -------------------------------------------------------------------------
    // Index
    // -------------------------------------------------------------------------
    describe('Index: events_destination_id_idx', () => {
        it.skipIf(!dbAvailable)('should exist in pg_indexes', async ({ skip }) => {
            if (!migrated) skip(NOT_MIGRATED_REASON);
            const idx = await getIndexInfo(ctx, 'events_destination_id_idx');
            expect(
                idx,
                'Index events_destination_id_idx was not found in pg_indexes'
            ).toBeDefined();
        });

        it.skipIf(!dbAvailable)('should be on the events table', async ({ skip }) => {
            if (!migrated) skip(NOT_MIGRATED_REASON);
            const idx = await getIndexInfo(ctx, 'events_destination_id_idx');
            expect(idx).toBeDefined();
            expect(idx?.tablename).toBe('events');
        });
    });
});
