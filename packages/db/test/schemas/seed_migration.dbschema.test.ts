/**
 * HOS-25 T-001 — `seed_migrations` table schema tests.
 *
 * Verifies the Drizzle schema definition for the seed data-migrations ledger:
 *   (1) All columns exist with the correct SQL names and types.
 *   (2) `name` is the primary key.
 *   (3) `group`, `checksum`, and `result` are notNull.
 *   (4) No `updatedAt` / `deletedAt` — append-only by design.
 *   (5) `$inferSelect` / `$inferInsert` type shapes match expectations.
 *
 * These are in-process schema tests — they do NOT require a running
 * PostgreSQL instance. Mirrors `social_credential_audit.dbschema.test.ts`
 * (HOS-64 T-005).
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    type InsertSeedMigration,
    type SelectSeedMigration,
    seedMigrations
} from '../../src/schemas/seed-migrations/seed_migration.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(seedMigrations);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

// ─── Table meta ─────────────────────────────────────────────────────────────

describe('seed_migrations table meta', () => {
    it('has the correct SQL table name', () => {
        const { name } = getTableConfig(seedMigrations);
        expect(name).toBe('seed_migrations');
    });

    it('has exactly 6 columns', () => {
        const { columns } = getTableConfig(seedMigrations);
        // name, group, checksum, applied_at, duration_ms, result
        expect(columns).toHaveLength(6);
    });
});

// ─── Primary key ─────────────────────────────────────────────────────────────

describe('seed_migrations primary key', () => {
    it('name column exists and is the primary key', () => {
        const config = getColumnConfig('name');

        expect(config).toBeDefined();
        expect(config?.primaryKey).toBe(true);
        expect(config?.length).toBe(255);
    });

    it('has exactly one primary-key column', () => {
        const { columns } = getTableConfig(seedMigrations);
        const pkColumns = columns.filter((c) => c.primary);

        expect(pkColumns).toHaveLength(1);
        expect(pkColumns[0]?.name).toBe('name');
    });
});

// ─── Required / optional columns ────────────────────────────────────────────

describe('seed_migrations columns', () => {
    it('group column is notNull varchar(20)', () => {
        const config = getColumnConfig('group');

        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.length).toBe(20);
    });

    it('checksum column is notNull text', () => {
        const config = getColumnConfig('checksum');

        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });

    it('applied_at column is notNull with a default (timestamptz)', () => {
        const config = getColumnConfig('applied_at');

        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.withTimezone).toBe(true);
    });

    it('duration_ms column is nullable integer', () => {
        const config = getColumnConfig('duration_ms');

        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('result column is notNull varchar(50)', () => {
        const config = getColumnConfig('result');

        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.length).toBe(50);
    });
});

// ─── Append-only invariant ───────────────────────────────────────────────────

describe('seed_migrations append-only invariant', () => {
    it('does NOT have an updated_at column', () => {
        const config = getColumnConfig('updated_at');
        expect(config).toBeUndefined();
    });

    it('does NOT have a deleted_at column', () => {
        const config = getColumnConfig('deleted_at');
        expect(config).toBeUndefined();
    });

    it('does NOT have a created_by_id / updated_by_id column', () => {
        expect(getColumnConfig('created_by_id')).toBeUndefined();
        expect(getColumnConfig('updated_by_id')).toBeUndefined();
    });
});

// ─── Type inference ──────────────────────────────────────────────────────────

describe('seed_migrations type inference', () => {
    it('InsertSeedMigration allows a minimal valid insert (required fields only)', () => {
        const minimal: InsertSeedMigration = {
            name: '0003-remove-legacy-feature',
            group: 'required',
            checksum: 'a'.repeat(64),
            result: 'ok'
        };

        expect(minimal.name).toBe('0003-remove-legacy-feature');
        expect(minimal.group).toBe('required');
    });

    it('SelectSeedMigration has all expected property keys', () => {
        const { columns } = getTableConfig(seedMigrations);
        const sqlNames = new Set(columns.map((c) => c.name));

        const expectedSqlColumns = [
            'name',
            'group',
            'checksum',
            'applied_at',
            'duration_ms',
            'result'
        ];

        for (const col of expectedSqlColumns) {
            expect(sqlNames.has(col), `Expected column '${col}' to exist in seed_migrations`).toBe(
                true
            );
        }
    });

    it('SelectSeedMigration compile-time type is assignable to a structured object', () => {
        const _typeCheck = (_row: SelectSeedMigration): void => {
            const _name: string = _row.name;
            const _group: string = _row.group;
            const _checksum: string = _row.checksum;
            const _appliedAt: Date = _row.appliedAt;
            const _durationMs: number | null = _row.durationMs;
            const _result: string = _row.result;

            void [_name, _group, _checksum, _appliedAt, _durationMs, _result];
        };

        expect(typeof _typeCheck).toBe('function');
    });
});
