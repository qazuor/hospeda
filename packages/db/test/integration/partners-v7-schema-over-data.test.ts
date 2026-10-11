import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/migrations');
const dbName = 'hospeda_v611_partners_over_data_test';
const duplicateDbName = 'hospeda_v611_partners_duplicates_test';
const baseUrl = process.env.HOSPEDA_TEST_DATABASE_URL;
if (!baseUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${dbName}`;
interface Entry {
    idx: number;
    tag: string;
}
let admin: Pool;
let db: Pool;
let duplicateDb: Pool | undefined;
const targetTag = '0151_v611_partners_for_v7';

async function apply(tag: string): Promise<void> {
    const content = readFileSync(join(migrationDir, `${tag}.sql`), 'utf8');
    for (const statement of content.split('--> statement-breakpoint')) {
        if (statement.trim()) await db.query(statement.trim());
    }
}

async function applyTargetAtomically(): Promise<void> {
    const content = readFileSync(join(migrationDir, `${targetTag}.sql`), 'utf8');
    await db.query('BEGIN');
    try {
        for (const statement of content.split('--> statement-breakpoint')) {
            if (statement.trim()) await db.query(statement.trim());
        }
        await db.query('COMMIT');
    } catch (error) {
        await db.query('ROLLBACK');
        throw error;
    }
}

async function buildBeforeTarget(): Promise<void> {
    await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await db.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await db.query('CREATE EXTENSION IF NOT EXISTS "unaccent"');
    const journal = JSON.parse(readFileSync(join(migrationDir, 'meta/_journal.json'), 'utf8')) as {
        entries: Entry[];
    };
    const target = journal.entries.find((entry) => entry.tag === targetTag);
    if (!target)
        throw new Error(
            `Migration ${targetTag} not generated (allowlist needs the branch's next migration number)`
        );
    for (const entry of journal.entries
        .filter((e) => e.idx < target.idx)
        .sort((a, b) => a.idx - b.idx))
        await apply(entry.tag);
}

beforeAll(async () => {
    admin = new Pool({ connectionString: adminUrl.toString() });
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.query(`CREATE DATABASE ${dbName}`);
    db = new Pool({ connectionString: testUrl.toString() });
    await buildBeforeTarget();
}, 300_000);

afterAll(async () => {
    if (db) await db.end();
    if (duplicateDb) await duplicateDb.end();
    if (admin) {
        try {
            await admin.query(
                'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',
                [dbName]
            );
            await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
            await admin.query(
                'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',
                [duplicateDbName]
            );
            await admin.query(`DROP DATABASE IF EXISTS ${duplicateDbName}`);
        } finally {
            await admin.end();
        }
    }
});

async function insertRows(duplicateOwner: boolean): Promise<
    Array<{
        id: string;
        slug: string;
        name: string;
        owner_user_id: string | null;
        lifecycle_state: string;
    }>
> {
    const users = await db.query<{ id: string }>(
        `INSERT INTO users(slug,email,display_name) VALUES ('v611-over-owner-a','v611-over-a@example.test','A'),('v611-over-owner-b','v611-over-b@example.test','B') RETURNING id`
    );
    const ownerA = users.rows[0]!.id;
    const ownerB = duplicateOwner ? ownerA : users.rows[1]!.id;
    const inputs = [
        ['v611-over-gold', 'Gold retained', 'gold', ownerA, '2025-01-01', '2025-12-31'],
        ['v611-over-silver', 'Silver retained', 'silver', ownerB, '2024-05-01', null],
        ['v611-over-null-a', 'Null owner A', 'gold', null, '2023-01-01', null],
        ['v611-over-null-b', 'Null owner B', 'silver', null, '2022-01-01', '2023-01-01']
    ] as const;
    const rows = [];
    for (const [slug, name, tier, owner, start, end] of inputs) {
        const inserted = await db.query<{
            id: string;
            slug: string;
            name: string;
            owner_user_id: string | null;
            lifecycle_state: string;
        }>(
            `INSERT INTO partners(slug,name,type,tier,owner_user_id,starts_at,ends_at,lifecycle_state) VALUES ($1,$2,'business',$3,$4,$5,$6,'ACTIVE') RETURNING id,slug,name,owner_user_id,lifecycle_state`,
            [slug, name, tier, owner, start, end]
        );
        rows.push(inserted.rows[0]!);
    }
    return rows;
}

describe('TEST:V6:30 — partners V7 migration over existing data', () => {
    it('TEST:V6:30 preserves every partner row and initializes the V7 columns', async () => {
        const before = await insertRows(false);
        await applyTargetAtomically();
        const after = await db.query<{
            id: string;
            slug: string;
            name: string;
            owner_user_id: string | null;
            lifecycle_state: string;
            presence_moderated: boolean;
            claim_secret_hash: string | null;
        }>(
            `SELECT id,slug,name,owner_user_id,lifecycle_state,presence_moderated,claim_secret_hash FROM partners ORDER BY slug`
        );
        expect(after.rows).toHaveLength(before.length);
        const oldProjection = after.rows.map(
            ({ id, slug, name, owner_user_id, lifecycle_state }) => ({
                id,
                slug,
                name,
                owner_user_id,
                lifecycle_state
            })
        );
        expect(oldProjection).toEqual([...before].sort((a, b) => a.slug.localeCompare(b.slug)));
        expect(
            after.rows.every(
                (row) => row.presence_moderated === false && row.claim_secret_hash === null
            )
        ).toBe(true);
    });

    it('TEST:V6:30 fails atomically on duplicate non-null owners and leaves the old columns intact', async () => {
        await admin.query(`CREATE DATABASE ${duplicateDbName}`);
        const mainDb = db;
        const duplicateUrl = new URL(baseUrl!);
        duplicateUrl.pathname = `/${duplicateDbName}`;
        duplicateDb = new Pool({ connectionString: duplicateUrl.toString() });
        db = duplicateDb;
        await buildBeforeTarget();
        await insertRows(true);
        await expect(applyTargetAtomically()).rejects.toMatchObject({
            code: '23505',
            constraint: 'uq_partners_owner_user_id'
        });
        const columns = await db.query<{ column_name: string }>(
            `SELECT column_name FROM information_schema.columns WHERE table_name='partners'`
        );
        expect(columns.rows.map((r) => r.column_name)).toEqual(
            expect.arrayContaining(['tier', 'starts_at', 'ends_at'])
        );
        db = mainDb;
    });
});
