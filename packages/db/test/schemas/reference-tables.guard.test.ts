import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REFERENCE_TABLES } from '../../src/schemas/vertical/reference-tables.ts';

const MIGRATIONS_DIR = join(__dirname, '../../src/migrations');

/**
 * Tables that receive migration INSERTs but are deliberately NOT reference tables.
 * Every entry needs a reason.
 */
const NOT_REFERENCE_TABLES: Readonly<Record<string, string>> = {
    role_permission: 'migration 0029 backfill; re-seeded by @repo/seed required data',
    user_role: 'migration 0069 backfill; re-seeded by @repo/seed required data',
    cutover_v6_deleted_listing:
        'migration 0148 passage table, absent from the drizzle schema; the cutover tool reads and drops it (V6.12 step 5b); transient, never seeded'
};

/** Collects every table named by an `INSERT INTO` in a structural migration. */
function collectInsertTargets(): ReadonlySet<string> {
    const targets = new Set<string>();
    const re = /INSERT\s+INTO\s+"?([a-z_][a-z0-9_]*)"?/gi;
    for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))) {
        const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
        for (const m of sql.matchAll(re)) targets.add((m[1] as string).toLowerCase());
    }
    return targets;
}

describe('REFERENCE_TABLES covers every table a migration inserts into (HOS-1827)', () => {
    it('parses a non-vacuous set of migration insert targets', () => {
        // Arrange / Act
        const targets = collectInsertTargets();

        // Assert
        expect(targets.size).toBeGreaterThan(10);
        expect(targets.has('plan')).toBe(true);
        expect(targets.has('billing_option')).toBe(true);
    });

    it('lists every migration-written table or explicitly allowlists it', () => {
        // Arrange
        const targets = collectInsertTargets();

        // Act
        const missing = [...targets].filter(
            (t) => !REFERENCE_TABLES.includes(t) && !(t in NOT_REFERENCE_TABLES)
        );

        // Assert
        expect(missing).toEqual([]);
    });

    it('keeps the allowlist free of tables that are already reference tables', () => {
        // Arrange / Act
        const overlap = Object.keys(NOT_REFERENCE_TABLES).filter((t) =>
            REFERENCE_TABLES.includes(t)
        );

        // Assert
        expect(overlap).toEqual([]);
    });
});
