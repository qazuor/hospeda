import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

/** Reserved structural migration tag for the paso-3 cut. */
export const CUT_MIGRATION_TAG = '0148_cut_paso_3';

/** Reads the paso-3 migration from the package source. */
export function readCutMigration(): string {
    return readFileSync(
        resolve(import.meta.dirname, `../../../src/migrations/${CUT_MIGRATION_TAG}.sql`),
        'utf8'
    );
}

/** Splits a Drizzle migration into individual SQL statements. */
export function splitCutStatements({ sql }: { readonly sql: string }): readonly string[] {
    return sql
        .split('--> statement-breakpoint')
        .map((part) => part.trim())
        .filter(Boolean);
}

/** Finds exactly one statement by a distinctive SQL fragment. */
export function findCutStatement({
    statements,
    fragment
}: {
    readonly statements: readonly string[];
    readonly fragment: string;
}): string {
    const matches = statements.filter((statement) => statement.includes(fragment));
    if (matches.length !== 1) throw new Error(`Expected one cut statement for ${fragment}`);
    return matches[0] ?? '';
}

/** Substitutes the owner's closed cut list for an isolated migration test. */
export function withCutList({
    sql,
    list
}: {
    readonly sql: string;
    readonly list: readonly object[];
}): string {
    const declaration = /(-- CUT-LIST:BEGIN[^\n]*\n\s*cut_list jsonb := ')[^']*('::jsonb;)/;
    if (!declaration.test(sql)) throw new Error('CUT-LIST declaration was not found');
    return sql.replace(declaration, `$1${JSON.stringify(list)}$2`);
}

interface PreCutDatabase {
    readonly admin: Pool;
    readonly database: Pool;
    readonly name: string;
}

/** Creates an isolated database and replays the structural journal through 0146. */
export async function createPreCutDatabase({
    name
}: {
    readonly name: string;
}): Promise<PreCutDatabase> {
    if (!/^hospeda_cut_[a-z0-9_]+$/.test(name)) throw new Error('Invalid cut test database name');
    const base = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!base) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
    const adminUrl = new URL(base);
    adminUrl.pathname = '/postgres';
    const databaseUrl = new URL(base);
    databaseUrl.pathname = `/${name}`;
    const admin = new Pool({ connectionString: adminUrl.toString() });
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
    const database = new Pool({ connectionString: databaseUrl.toString() });
    for (const extension of ['uuid-ossp', 'pgcrypto', 'unaccent']) {
        await database.query(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
    }
    const directory = resolve(import.meta.dirname, '../../../src/migrations');
    const journal = JSON.parse(readFileSync(resolve(directory, 'meta/_journal.json'), 'utf8')) as {
        entries: { readonly idx: number; readonly tag: string }[];
    };
    const cutIndex = journal.entries.find((entry) => entry.tag === CUT_MIGRATION_TAG)?.idx;
    if (cutIndex === undefined) throw new Error(`Missing journal entry ${CUT_MIGRATION_TAG}`);
    for (const entry of journal.entries
        .filter((candidate) => candidate.idx < cutIndex)
        .sort((a, b) => a.idx - b.idx)) {
        const migration = readFileSync(resolve(directory, `${entry.tag}.sql`), 'utf8');
        for (const statement of splitCutStatements({ sql: migration }))
            await database.query(statement);
    }
    return { admin, database, name };
}

/** Drops only the isolated database created by createPreCutDatabase. */
export async function dropPreCutDatabase({ admin, database, name }: PreCutDatabase): Promise<void> {
    await database.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
}
