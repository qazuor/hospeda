// TEST:V1:6 (AC:V1:4) — the key table that `db:migrate` writes on an empty database is
// the SQL the generator produces, and an assignment pointing at it by FK rejects an
// unknown key and accepts a regenerated one.
//
// The real plan-assignment table and its FK arrive with V2.1. Until then the FK is
// proved with a throwaway table, created inside a transaction that is always rolled
// back, that references `catalog_key(key)` exactly as that assignment table will.
// That the three databases (development, integration, nightly e2e) are all built by
// `db:migrate` is the static half of TEST:V1:6, in
// `scripts/__tests__/reference-rows-single-source.test.ts`.
import { afterAll, describe, expect, it } from 'vitest';
import { buildCatalogKeyLoad, renderInsert } from '../../../../scripts/generate-catalog-sql.ts';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

/**
 * The stand-in for V2.1's assignment table: one FK to the key table, nothing else.
 * A real (not `TEMP`) table, because Postgres forbids a temporary table's FK from
 * referencing a permanent one; it only ever exists inside a rolled-back transaction.
 */
const PROBE_TABLE = `CREATE TABLE plan_key_assignment_probe (
    plan_id varchar(64) NOT NULL,
    key varchar(64) NOT NULL REFERENCES catalog_key (key)
)`;

/** Runs `statements` in one transaction that is always rolled back; returns the first error. */
async function inRolledBackTransaction(
    statements: readonly string[]
): Promise<{ code?: string; constraint?: string } | null> {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        for (const statement of statements) await client.query(statement);
        return null;
    } catch (error) {
        return error as { code?: string; constraint?: string };
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}

describe('TEST:V1:6 — the key table from the generated SQL, guarded by FK', () => {
    it('holds, after db:migrate from empty, exactly the rows the generator produces', async () => {
        const load = buildCatalogKeyLoad();
        const { rows } = await getTestPool().query<Record<string, string>>(
            `SELECT ${load.columns.join(', ')} FROM catalog_key`
        );

        const actual = rows.map((row) => load.columns.map((column) => row[column] ?? null));
        const byKey = (a: readonly unknown[], b: readonly unknown[]) =>
            String(a[0]).localeCompare(String(b[0]));
        expect([...actual].sort(byKey)).toEqual([...load.rows].sort(byKey));
    });

    it('rejects, by FK, an assignment whose key is not in the table', async () => {
        const error = await inRolledBackTransaction([
            PROBE_TABLE,
            "INSERT INTO plan_key_assignment_probe (plan_id, key) VALUES ('p1', 'not_a_catalog_key')"
        ]);

        expect(error?.code).toBe('23503');
    });

    it('accepts an assignment whose key exists', async () => {
        const error = await inRolledBackTransaction([
            PROBE_TABLE,
            "INSERT INTO plan_key_assignment_probe (plan_id, key) VALUES ('p1', 'max_accommodations')"
        ]);

        expect(error).toBeNull();
    });

    it('accepts an assignment with a NEW key once its regenerated row is written', async () => {
        const newKey = buildCatalogKeyLoad({
            definitions: [
                {
                    key: 'zz_regenerated_capability',
                    kind: 'entitlement',
                    scope: 'vertical',
                    aggregationStrategy: 'MAX',
                    enforcementStrategy: 'NONE',
                    keyClass: 'COMMERCIAL'
                }
            ]
        });
        const assign =
            "INSERT INTO plan_key_assignment_probe (plan_id, key) VALUES ('p1', 'zz_regenerated_capability')";

        const before = await inRolledBackTransaction([PROBE_TABLE, assign]);
        const after = await inRolledBackTransaction([
            renderInsert({ load: newKey }),
            PROBE_TABLE,
            assign
        ]);

        expect(before?.code).toBe('23503');
        expect(after).toBeNull();
    });
});
