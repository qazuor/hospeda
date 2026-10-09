import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generatePlanCatalogSql } from '../../../../scripts/production-catalog/loads.js';

const migrationDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/migrations');
const dbName = 'hospeda_v24a_catalog_test';
const baseUrl = process.env.HOSPEDA_TEST_DATABASE_URL;
if (!baseUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${dbName}`;
let admin: Pool;
let db: Pool;

async function applyGenerated(
    client: { query(sql: string): Promise<unknown> },
    sql = generatePlanCatalogSql()
) {
    for (const chunk of sql.split('--> statement-breakpoint')) {
        if (chunk.trim()) await client.query(chunk.trim());
    }
}

beforeAll(async () => {
    admin = new Pool({ connectionString: adminUrl.toString() });
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${dbName}`);
    db = new Pool({ connectionString: testUrl.toString() });
    for (const extension of ['uuid-ossp', 'pgcrypto', 'unaccent']) {
        await db.query(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
    }
    const journal = JSON.parse(readFileSync(join(migrationDir, 'meta/_journal.json'), 'utf8')) as {
        entries: { idx: number; tag: string }[];
    };
    for (const entry of journal.entries.sort((a, b) => a.idx - b.idx)) {
        const sql = readFileSync(join(migrationDir, `${entry.tag}.sql`), 'utf8');
        await applyGenerated(db, sql);
    }
}, 300_000);

afterAll(async () => {
    if (db) await db.end();
    if (admin) {
        await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
        await admin.end();
    }
});

describe('TEST:V2:11 — generated catalog SQL on a database migrated from zero', () => {
    it('loads four plans and their versions before any cutover C write', async () => {
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            await applyGenerated(client);
            const plans = await client.query<{ slug: string; role: string | null }>(
                'SELECT slug, role FROM plan ORDER BY slug'
            );
            expect(plans.rows).toHaveLength(4);
            expect(plans.rows.map((row) => row.role)).toEqual([
                'floor',
                'pre_trial',
                null,
                'trial'
            ]);
            const versions = await client.query<{ count: string }>(
                'SELECT count(*)::text AS count FROM plan_version'
            );
            expect(versions.rows[0]?.count).toBe('4');
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });
});

describe('TEST:V2:12 — atomic catalog load over existing data', () => {
    it('rolls back all catalog rows when a later statement fails', async () => {
        await db.query(
            "INSERT INTO plan (vertical, slug, name) VALUES ('accommodation', 'preexisting-v24a', 'Existing')"
        );
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            const poisoned = `${generatePlanCatalogSql()}\n--> statement-breakpoint\nINSERT INTO plan (id) VALUES ('not-a-uuid');`;
            await expect(applyGenerated(client, poisoned)).rejects.toThrow();
            await client.query('ROLLBACK');
            for (const table of [
                'plan',
                'plan_version',
                'plan_version_entitlement',
                'plan_version_limit'
            ]) {
                const result = await db.query<{ count: string }>(
                    `SELECT count(*)::text AS count FROM "${table}"`
                );
                expect(result.rows[0]?.count).toBe(table === 'plan' ? '1' : '0');
            }
            const existing = await db.query<{ count: string }>(
                "SELECT count(*)::text AS count FROM plan WHERE slug = 'preexisting-v24a'"
            );
            expect(existing.rows[0]?.count).toBe('1');
        } finally {
            client.release();
            await db.query("DELETE FROM plan WHERE slug = 'preexisting-v24a'");
        }
    });
});
