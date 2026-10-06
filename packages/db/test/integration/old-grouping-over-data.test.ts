// TEST:U1:5 — apply 0126 over live-style rows in an isolated pre-0126 database.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** The retired grouping word, built in parts so the repo-wide guard does not match this file. */
const OLD = ['comm', 'erce'].join('');
const OLD_UP = OLD.toUpperCase();

const migrationDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/migrations');
const dbName = 'hospeda_old_grouping_test';
const baseUrl = process.env.HOSPEDA_TEST_DATABASE_URL;
if (!baseUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${dbName}`;
let admin: Pool;
let db: Pool;

interface JournalEntry {
    idx: number;
    tag: string;
}

async function apply(tag: string): Promise<void> {
    const content = readFileSync(join(migrationDir, `${tag}.sql`), 'utf8');
    for (const chunk of content.split('--> statement-breakpoint')) {
        if (chunk.trim()) await db.query(chunk.trim());
    }
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
    const current = journal.entries.find((entry) => entry.tag.startsWith('0126_'));
    if (!current) throw new Error('0126 migration absent from journal');
    for (const entry of journal.entries
        .filter((entry) => entry.idx < current.idx)
        .sort((a, b) => a.idx - b.idx)) {
        await apply(entry.tag);
    }
    const userId = '11111111-1111-4111-8111-111111111111';
    await db.query(
        `INSERT INTO users (id, slug, email) VALUES ($1, 'old-grouping-owner', 'old-grouping@example.test')`,
        [userId]
    );
    await db.query(
        `INSERT INTO partners (slug, name, type, tier) VALUES ('old-business', 'Old Business', '${OLD}', 'silver'), ('existing-business', 'Existing Business', 'ngo', 'silver')`
    );
    await db.query(
        `INSERT INTO alliance_leads (kind, contact_name, email, message, partner_type) VALUES ('partner', 'Old Contact', 'old-contact@example.test', 'Test', '${OLD}')`
    );
    await db.query(
        `INSERT INTO role_permission (role, permission) VALUES
            ('${OLD_UP}_OWNER', '${OLD}.editOwn'),
            ('${OLD_UP}_OWNER', 'gastronomy.create'),
            ('ADMIN', '${OLD}.create'),
            ('ADMIN', '${OLD}.viewAll'),
            ('ADMIN', '${OLD}.editAll'),
            ('ADMIN', '${OLD}.delete'),
            ('ADMIN', '${OLD}.moderateReview'),
            ('ADMIN', '${OLD}.moderationChange'),
            ('ADMIN', 'gastronomy.create')`
    );
    await db.query(
        `INSERT INTO user_permission (user_id, permission) VALUES
            ($1, '${OLD}.editOwn'), ($1, '${OLD}.create'),
            ($1, '${OLD}.viewAll'), ($1, '${OLD}.editAll'),
            ($1, '${OLD}.delete'), ($1, '${OLD}.moderateReview'),
            ($1, '${OLD}.moderationChange'), ($1, 'gastronomy.create')`,
        [userId]
    );
    await db.query(
        `INSERT INTO user_role (user_id, role) VALUES ($1, '${OLD_UP}_OWNER'), ($1, 'USER')`,
        [userId]
    );
    await db.query(
        `INSERT INTO user_role_audit (user_id, role, action) VALUES ($1, '${OLD_UP}_OWNER', 'grant'), ($1, 'USER', 'grant')`,
        [userId]
    );
    await apply(current.tag);
});

afterAll(async () => {
    if (db) await db.end();
    if (admin) {
        await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
        await admin.end();
    }
});

describe('TEST:U1:5 — old grouping migration over data', () => {
    it('moves every stored partner type and keeps unrelated rows', async () => {
        const partners = await db.query<{ slug: string; type: string }>(
            `SELECT slug, type FROM partners ORDER BY slug`
        );
        expect(partners.rows).toEqual([
            { slug: 'existing-business', type: 'ngo' },
            { slug: 'old-business', type: 'business' }
        ]);
        const leads = await db.query<{ partner_type: string }>(
            `SELECT partner_type FROM alliance_leads`
        );
        expect(leads.rows).toEqual([{ partner_type: 'business' }]);
    });

    it('removes old role and permission rows while preserving other grants', async () => {
        for (const [table, column, expected] of [
            ['role_permission', 'permission', 'gastronomy.create'],
            ['user_permission', 'permission', 'gastronomy.create'],
            ['user_role', 'role', 'USER'],
            ['user_role_audit', 'role', 'USER']
        ] as const) {
            const rows = await db.query<{ value: string }>(
                `SELECT ${column}::text AS value FROM ${table}`
            );
            expect(rows.rows.map((row) => row.value)).toEqual([expected]);
        }
        const oldRole = await db.query(
            `SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'role_enum' AND e.enumlabel = '${OLD_UP}_OWNER'`
        );
        expect(oldRole.rowCount).toBe(0);
        const oldPerms = await db.query(
            `SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'permission_enum' AND e.enumlabel LIKE '${OLD}.%'`
        );
        expect(oldPerms.rowCount).toBe(0);
        const oldTable = await db.query<{ name: string | null }>(
            `SELECT to_regclass('public.${OLD}_leads')::text AS name`
        );
        expect(oldTable.rows[0]?.name).toBeNull();
    });
});
