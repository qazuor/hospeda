import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PRODUCTION_PLAN_CATALOG } from '../../../../scripts/production-catalog/catalog.js';
import { buildPlanCatalogLoads } from '../../../../scripts/production-catalog/loads.js';

const migrationDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/migrations');
const baseUrl = process.env.HOSPEDA_TEST_DATABASE_URL;
if (!baseUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const admin = new Pool({ connectionString: adminUrl.toString() });
const names = ['hospeda_v24b_catalog_full_test', 'hospeda_v24b_catalog_rollback_test'] as const;
const pools: Pool[] = [];
const journal = JSON.parse(readFileSync(join(migrationDir, 'meta/_journal.json'), 'utf8')) as {
    entries: { idx: number; tag: string }[];
};

async function applySql(
    client: { query(sql: string): Promise<unknown> },
    sql: string
): Promise<void> {
    for (const chunk of sql.split('--> statement-breakpoint')) {
        if (chunk.trim()) await client.query(chunk.trim());
    }
}

async function freshDatabase(name: string, lastIndex: number): Promise<Pool> {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${name}`);
    const url = new URL(baseUrl as string);
    url.pathname = `/${name}`;
    const db = new Pool({ connectionString: url.toString() });
    pools.push(db);
    for (const extension of ['uuid-ossp', 'pgcrypto', 'unaccent']) {
        await db.query(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
    }
    for (const entry of journal.entries
        .filter((item) => item.idx <= lastIndex)
        .sort((a, b) => a.idx - b.idx)) {
        await applySql(db, readFileSync(join(migrationDir, `${entry.tag}.sql`), 'utf8'));
    }
    return db;
}

let full: Pool;
let beforeCatalog: Pool;
beforeAll(async () => {
    full = await freshDatabase(names[0], 144);
    beforeCatalog = await freshDatabase(names[1], 143);
}, 300_000);

afterAll(async () => {
    for (const pool of pools) await pool.end();
    for (const name of names) await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
});

describe('TEST:V2:11 — 0144 writes the exact production catalog from zero', () => {
    it('matches every generated row and has one current version per plan and one role plan per vertical', async () => {
        for (const load of buildPlanCatalogLoads()) {
            const columns = load.columns.map((column) => `"${column}"`).join(', ');
            const result = await full.query(`SELECT ${columns} FROM "${load.table}" ORDER BY "id"`);
            const actual = result.rows.map((row) => load.columns.map((column) => row[column]));
            const expected = [...load.rows].sort((a, b) =>
                String(a[0]).localeCompare(String(b[0]))
            );
            expect(actual, load.table).toEqual(expected);
        }
        const versions = await full.query<{ plan_id: string; current_count: string }>(
            'SELECT plan_id, count(*) FILTER (WHERE current)::text AS current_count FROM plan_version GROUP BY plan_id'
        );
        expect(versions.rows).toHaveLength(PRODUCTION_PLAN_CATALOG.length);
        expect(versions.rows.every((row) => row.current_count === '1')).toBe(true);
        const roles = await full.query<{ vertical: string; role: string; count: string }>(
            'SELECT vertical, role, count(*)::text AS count FROM plan WHERE role IS NOT NULL GROUP BY vertical, role'
        );
        expect(roles.rows).toHaveLength(15);
        expect(roles.rows.every((row) => row.count === '1')).toBe(true);
    });
});

describe('TEST:V2:12 — 0144 is atomic over existing data', () => {
    it('rolls back all four catalog tables when a later statement fails and keeps the earlier row', async () => {
        await beforeCatalog.query(
            "INSERT INTO plan (vertical, slug, name) VALUES ('accommodation', 'preexisting-v24b', 'Existing')"
        );
        const client = await beforeCatalog.connect();
        try {
            await client.query('BEGIN');
            const sql = readFileSync(
                join(migrationDir, '0144_production_plan_catalog.sql'),
                'utf8'
            );
            await expect(
                applySql(
                    client,
                    `${sql}\n--> statement-breakpoint\nINSERT INTO plan (id) VALUES ('not-a-uuid');`
                )
            ).rejects.toThrow();
            await client.query('ROLLBACK');
        } finally {
            client.release();
        }
        for (const table of [
            'plan',
            'plan_version',
            'plan_version_entitlement',
            'plan_version_limit'
        ]) {
            const result = await beforeCatalog.query<{ count: string }>(
                `SELECT count(*)::text AS count FROM "${table}"`
            );
            expect(result.rows[0]?.count, table).toBe(table === 'plan' ? '1' : '0');
        }
        const existing = await beforeCatalog.query(
            "SELECT slug, name FROM plan WHERE slug = 'preexisting-v24b'"
        );
        expect(existing.rows).toEqual([{ slug: 'preexisting-v24b', name: 'Existing' }]);
    });
});
