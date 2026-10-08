import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/migrations');
const dbName = 'hospeda_b3_migration_over_data_test';
const baseUrl = process.env.HOSPEDA_TEST_DATABASE_URL;
if (!baseUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${dbName}`;

interface JournalEntry {
    idx: number;
    tag: string;
}
interface Fingerprint {
    count: string;
    digest: string;
}
let admin: Pool;
let db: Pool;
let before: Record<string, Fingerprint>;

async function apply(tag: string): Promise<void> {
    const content = readFileSync(join(migrationDir, `${tag}.sql`), 'utf8');
    for (const chunk of content.split('--> statement-breakpoint')) {
        if (chunk.trim()) await db.query(chunk.trim());
    }
}

async function fingerprints(): Promise<Record<string, Fingerprint>> {
    const result: Record<string, Fingerprint> = {};
    for (const table of [
        'users',
        'plan',
        'plan_version',
        'billing_option',
        'billing_deadline_version'
    ]) {
        const query = await db.query<Fingerprint>(
            `SELECT count(*)::text AS count, md5(coalesce(string_agg(row_to_json(t)::text, '|' ORDER BY row_to_json(t)::text), '')) AS digest FROM ${table} t`
        );
        result[table] = query.rows[0] as Fingerprint;
    }
    return result;
}

beforeAll(async () => {
    admin = new Pool({ connectionString: adminUrl.toString() });
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.query(`CREATE DATABASE ${dbName}`);
    db = new Pool({ connectionString: testUrl.toString() });
    await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await db.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await db.query('CREATE EXTENSION IF NOT EXISTS "unaccent"');
    const journal = JSON.parse(readFileSync(join(migrationDir, 'meta/_journal.json'), 'utf8')) as {
        entries: JournalEntry[];
    };
    const target = journal.entries.find((entry) => entry.tag.startsWith('0139_'));
    if (!target) throw new Error('B3 migration absent from journal');
    for (const entry of journal.entries
        .filter((e) => e.idx < target.idx)
        .sort((a, b) => a.idx - b.idx))
        await apply(entry.tag);

    const user = await db.query<{ id: string }>(
        "INSERT INTO users (slug, email) VALUES ('b3-over-data', 'b3-over-data@example.test') RETURNING id"
    );
    const plan = await db.query<{ id: string }>(
        "INSERT INTO plan (vertical, slug, name) VALUES ('accommodation', 'b3-over-data', 'B3 fixture') RETURNING id"
    );
    const version = await db.query<{ id: string }>(
        "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, 'accommodation', 100, true, true, 0, true) RETURNING id",
        [plan.rows[0]?.id]
    );
    await db.query(
        "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 1000, 'ARS')",
        [version.rows[0]?.id]
    );
    expect(user.rows).toHaveLength(1);
    before = await fingerprints();
    for (const entry of journal.entries
        .filter((e) => e.idx >= target.idx)
        .sort((a, b) => a.idx - b.idx))
        await apply(entry.tag);
}, 300_000);

afterAll(async () => {
    if (db) await db.end();
    if (admin) {
        try {
            await admin.query(
                'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
                [dbName]
            );
            await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
        } finally {
            await admin.end();
        }
    }
});

describe('TEST:B3:32 — B3 migration over existing rows', () => {
    it('preserves counts and hashes of all preexisting fixture tables', async () => {
        expect(await fingerprints()).toEqual(before);
        expect(before.users?.count).not.toBe('0');
        expect(before.plan?.count).not.toBe('0');
        expect(before.plan_version?.count).not.toBe('0');
        expect(before.billing_option?.count).not.toBe('0');
    });

    it('creates both invariant 8 partial indexes', async () => {
        const indexes = await db.query<{ indexname: string; indexdef: string }>(
            "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'subscription'"
        );
        expect(
            indexes.rows.find((r) => r.indexname === 'uq_subscription_commitment_origin')?.indexdef
        ).toContain('CREATE UNIQUE INDEX');
        expect(
            indexes.rows.find((r) => r.indexname === 'uq_subscription_commitment_successor')
                ?.indexdef
        ).toContain('CREATE UNIQUE INDEX');
    });
});
