// HOS-1825 (HOS-1352 1.B7) — the migration that recreates
// `ck_content_moderation_terms_kind`, applied OVER the shape production holds.
//
// The cutover rehearsal on a real production dump found one schema difference
// against a database built from scratch: production stores this CHECK with a
// per-literal text cast, a fresh database stores a whole-array cast. Same
// predicate, different stored text, and the cutover fingerprint compares text.
//
// This file builds an isolated database at the state right BEFORE the migration
// (every journal entry before it replayed), records the from-scratch definition,
// swaps the CHECK for the production form measured on the dump, writes rows,
// then applies the migration. The definition must come out byte-identical to the
// from-scratch one, every row must survive, and the predicate must still reject.
//
// Like `retire-user-impersonate-over-data.test.ts`, this file provisions and
// tears down its OWN database so it can stand on the pre-migration side.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/migrations');
const dbName = 'hospeda_moderation_kind_check_test';
const baseUrl = process.env.HOSPEDA_TEST_DATABASE_URL;
if (!baseUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${dbName}`;

/** The migration this test targets, found in the journal by its name suffix. */
const TARGET_SUFFIX = '_hos1825_moderation_kind_check';
const TABLE = 'content_moderation_terms';
const CONSTRAINT = 'ck_content_moderation_terms_kind';

/**
 * The CHECK exactly as the production dump stores it (schema-only restore of
 * the 2026-10-28 rehearsal dump): one text cast per literal.
 */
const PRODUCTION_CHECK = `CHECK (((kind)::text = ANY (ARRAY[('word'::character varying)::text, ('domain'::character varying)::text])))`;

interface TermRow {
    readonly term: string;
    readonly kind: string;
    readonly category: string;
}

const ROWS: readonly TermRow[] = [
    { term: 'spamword', kind: 'word', category: 'spam' },
    { term: 'bad.example', kind: 'domain', category: 'spam' },
    { term: 'insulto', kind: 'word', category: 'profanity' }
];

interface JournalEntry {
    idx: number;
    tag: string;
}

let admin: Pool;
let db: Pool;
let targetTag = '';
let fromScratchDef = '';
let productionDef = '';
let afterDef = '';

async function apply(tag: string): Promise<void> {
    const content = readFileSync(join(migrationDir, `${tag}.sql`), 'utf8');
    for (const chunk of content.split('--> statement-breakpoint')) {
        if (chunk.trim()) await db.query(chunk.trim());
    }
}

async function constraintDef(): Promise<string> {
    const result = await db.query<{ def: string }>(
        `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         WHERE t.relname = $1 AND c.conname = $2`,
        [TABLE, CONSTRAINT]
    );
    expect(result.rows).toHaveLength(1);
    return result.rows[0]?.def ?? '';
}

async function snapshotRows(): Promise<TermRow[]> {
    const result = await db.query<TermRow>(
        `SELECT term, kind, category FROM ${TABLE} ORDER BY term`
    );
    return result.rows;
}

const sortRows = (rows: readonly TermRow[]): TermRow[] =>
    [...rows].sort((a, b) => a.term.localeCompare(b.term));

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
    targetTag = target.tag;
    for (const entry of journal.entries
        .filter((entry) => entry.idx < target.idx)
        .sort((a, b) => a.idx - b.idx)) {
        await apply(entry.tag);
    }
    fromScratchDef = await constraintDef();

    await db.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT ${CONSTRAINT}`);
    await db.query(`ALTER TABLE ${TABLE} ADD CONSTRAINT ${CONSTRAINT} ${PRODUCTION_CHECK}`);
    productionDef = await constraintDef();
    for (const row of ROWS) {
        await db.query(`INSERT INTO ${TABLE} (term, kind, category) VALUES ($1, $2, $3)`, [
            row.term,
            row.kind,
            row.category
        ]);
    }

    await apply(target.tag);
    afterDef = await constraintDef();
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

describe('HOS-1825 — ck_content_moderation_terms_kind recreated over the production form', () => {
    it('the fixture really held the production form, which differs from the from-scratch one', () => {
        expect(productionDef).toBe(PRODUCTION_CHECK);
        expect(fromScratchDef).not.toBe('');
        expect(productionDef).not.toBe(fromScratchDef);
    });

    it('leaves the CHECK definition identical to a database built from scratch', () => {
        expect(afterDef).toBe(fromScratchDef);
    });

    it('keeps every existing row', async () => {
        expect(sortRows(await snapshotRows())).toEqual(sortRows(ROWS));
    });

    it('still rejects a kind outside the allowed set', async () => {
        await expect(
            db.query(`INSERT INTO ${TABLE} (term, kind, category) VALUES ('x', 'phrase', 'spam')`)
        ).rejects.toMatchObject({ code: '23514', constraint: CONSTRAINT });
    });

    it('is idempotent: applying it again changes nothing', async () => {
        await apply(targetTag);
        expect(await constraintDef()).toBe(fromScratchDef);
        expect(sortRows(await snapshotRows())).toEqual(sortRows(ROWS));
    });
});
