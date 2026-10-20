// TEST:V5:29 — the HOS-1458 (HOS-1352 V5) migration that retires
// `user.impersonate`, applied OVER live-style data.
//
// Builds an isolated database at the state right BEFORE the migration (every
// journal entry before it replayed), writes one `role_permission` row and one
// `user_permission` override granting `user.impersonate`, next to other grants
// that must survive, then applies the migration. It must recreate
// `permission_enum` without the value, remove exactly those two rows, and leave
// every other role and override row unchanged.
//
// Like `old-billing-untangle-over-data.test.ts`, this file provisions and tears
// down its OWN database so it can stand on the pre-migration side of history.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/migrations');
const dbName = 'hospeda_retire_user_impersonate_test';
const baseUrl = process.env.HOSPEDA_TEST_DATABASE_URL;
if (!baseUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${dbName}`;

/** The migration this test targets, found in the journal by its name suffix. */
const TARGET_SUFFIX = '_retire_user_impersonate';

const RETIRED = 'user.impersonate';
const USER_ID = '11111111-1111-4111-8111-111111111111';

interface PermissionRow {
    readonly role?: string;
    readonly user_id?: string;
    readonly permission: string;
    readonly effect?: string;
}

/** Rows that must come out of the migration exactly as they went in. */
const SURVIVING_ROLE_ROWS: readonly PermissionRow[] = [
    { role: 'ADMIN', permission: 'user.read.all' },
    { role: 'SUPER_ADMIN', permission: 'user.update.roles' },
    { role: 'SUPER_ADMIN', permission: 'gastronomy.create' }
];
const SURVIVING_USER_ROWS: readonly PermissionRow[] = [
    { user_id: USER_ID, permission: 'user.read.all', effect: 'grant' },
    { user_id: USER_ID, permission: 'gastronomy.create', effect: 'deny' }
];

interface JournalEntry {
    idx: number;
    tag: string;
}

let admin: Pool;
let db: Pool;

async function apply(tag: string): Promise<void> {
    const content = readFileSync(join(migrationDir, `${tag}.sql`), 'utf8');
    for (const chunk of content.split('--> statement-breakpoint')) {
        if (chunk.trim()) await db.query(chunk.trim());
    }
}

async function snapshotRoleRows(): Promise<PermissionRow[]> {
    const rows = await db.query<PermissionRow>(
        'SELECT role::text AS role, permission::text AS permission FROM role_permission ORDER BY 1, 2'
    );
    return rows.rows;
}

async function snapshotUserRows(): Promise<PermissionRow[]> {
    const rows = await db.query<PermissionRow>(
        `SELECT user_id::text AS user_id, permission::text AS permission, effect::text AS effect
         FROM user_permission ORDER BY 1, 2`
    );
    return rows.rows;
}

const sortRows = (rows: readonly PermissionRow[]): PermissionRow[] =>
    [...rows].sort((a, b) =>
        `${a.role ?? a.user_id}|${a.permission}`.localeCompare(
            `${b.role ?? b.user_id}|${b.permission}`
        )
    );

let roleRowsBefore: PermissionRow[] = [];
let userRowsBefore: PermissionRow[] = [];

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
    const target = journal.entries.find((entry) => entry.tag.endsWith(TARGET_SUFFIX));
    if (!target) throw new Error(`*${TARGET_SUFFIX} migration absent from journal`);
    for (const entry of journal.entries
        .filter((entry) => entry.idx < target.idx)
        .sort((a, b) => a.idx - b.idx)) {
        await apply(entry.tag);
    }

    await db.query(
        `INSERT INTO users (id, slug, email) VALUES ($1, 'impersonate-holder', 'impersonate@example.test')`,
        [USER_ID]
    );
    await db.query(`INSERT INTO role_permission (role, permission) VALUES ('SUPER_ADMIN', $1)`, [
        RETIRED
    ]);
    await db.query(
        `INSERT INTO user_permission (user_id, permission, effect) VALUES ($1, $2, 'grant')`,
        [USER_ID, RETIRED]
    );
    for (const row of SURVIVING_ROLE_ROWS) {
        await db.query('INSERT INTO role_permission (role, permission) VALUES ($1, $2)', [
            row.role,
            row.permission
        ]);
    }
    for (const row of SURVIVING_USER_ROWS) {
        await db.query(
            'INSERT INTO user_permission (user_id, permission, effect) VALUES ($1, $2, $3)',
            [row.user_id, row.permission, row.effect]
        );
    }
    roleRowsBefore = await snapshotRoleRows();
    userRowsBefore = await snapshotUserRows();

    await apply(target.tag);
}, 300_000);

afterAll(async () => {
    if (db) await db.end();
    if (admin) {
        await admin.query(
            `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
             WHERE datname = $1 AND pid <> pg_backend_pid()`,
            [dbName]
        );
        await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
        await admin.end();
    }
});

describe('TEST:V5:29 — user.impersonate retired over live-style data', () => {
    it('the fixture really held one role row and one override granting the retired value', () => {
        expect(roleRowsBefore.filter((row) => row.permission === RETIRED)).toHaveLength(1);
        expect(userRowsBefore.filter((row) => row.permission === RETIRED)).toHaveLength(1);
    });

    it('recreates permission_enum without user.impersonate', async () => {
        const labels = await db.query<{ label: string }>(
            `SELECT e.enumlabel AS label FROM pg_enum e
             JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'permission_enum'`
        );
        const values = labels.rows.map((row) => row.label);
        expect(values.length).toBeGreaterThan(0);
        expect(values).not.toContain(RETIRED);
        expect(values).toContain('user.read.all');
    });

    it('keeps both permission columns typed with the recreated enum', async () => {
        const columns = await db.query<{ table_name: string; udt_name: string }>(
            `SELECT table_name, udt_name FROM information_schema.columns
             WHERE table_schema = 'public' AND column_name = 'permission'
               AND table_name IN ('role_permission', 'user_permission')
             ORDER BY 1`
        );
        expect(columns.rows).toEqual([
            { table_name: 'role_permission', udt_name: 'permission_enum' },
            { table_name: 'user_permission', udt_name: 'permission_enum' }
        ]);
    });

    it('removes the role row and the override that granted it, and changes no other row', async () => {
        expect(sortRows(await snapshotRoleRows())).toEqual(sortRows(SURVIVING_ROLE_ROWS));
        expect(sortRows(await snapshotUserRows())).toEqual(sortRows(SURVIVING_USER_ROWS));
    });
});
