import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

/** Minimal slice of a pg client used by the helpers. */
export interface PgClient {
    readonly connect: () => Promise<void>;
    readonly query: (
        sql: string,
        params?: readonly unknown[]
    ) => Promise<{ readonly rows: readonly Record<string, unknown>[] }>;
    readonly end: () => Promise<void>;
}

type PgClientCtor = new (config: { connectionString: string }) => PgClient;

/** Resolves `pg` from the db package install (no root dependency is added for a throwaway script). */
function loadClient(): PgClientCtor {
    const requireFromDb = createRequire(path.join(repoRoot, 'packages/db/package.json'));
    return (requireFromDb('pg') as { Client: PgClientCtor }).Client;
}

/** Opens a connected client. */
export async function connect({ url }: { readonly url: string }): Promise<PgClient> {
    const Client = loadClient();
    const client = new Client({ connectionString: url });
    await client.connect();
    return client;
}

/** The URL of the same server, pointing at another database. */
export function withDatabase({
    url,
    database
}: {
    readonly url: string;
    readonly database: string;
}): string {
    const parsed = new URL(url);
    parsed.pathname = `/${database}`;
    return parsed.toString();
}

/**
 * Reads the admin URL of the test server. A missing value is a FAILURE, never a skip:
 * a skipped database test reads as green and proves nothing.
 */
export function requireAdminUrl(): string {
    const url = Reflect.get(process.env, 'HOSPEDA_TEST_DATABASE_URL');
    if (typeof url !== 'string' || url.length === 0) {
        throw new Error('HOSPEDA_TEST_DATABASE_URL is required for the cutover database tests');
    }
    return url;
}

/** Where a migration chain comes from. */
export type MigrationSource =
    | { readonly kind: 'git-ref'; readonly ref: string }
    | { readonly kind: 'working-tree' };

function readSource({
    source,
    file
}: {
    readonly source: MigrationSource;
    readonly file: string;
}): string {
    const rel = `packages/db/src/migrations/${file}`;
    if (source.kind === 'working-tree') return readFileSync(path.join(repoRoot, rel), 'utf8');
    // argv list, no shell: ref and rel are fixed test inputs, not untrusted data
    // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
    return execFileSync('git', ['-C', repoRoot, 'show', `${source.ref}:${rel}`], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });
}

/** Applies a whole migration chain, in journal order, to an empty database. */
export async function applyMigrations({
    client,
    source
}: {
    readonly client: PgClient;
    readonly source: MigrationSource;
}): Promise<number> {
    const journal = JSON.parse(readSource({ source, file: 'meta/_journal.json' })) as {
        entries: { tag: string }[];
    };
    for (const { tag } of journal.entries) {
        const sql = readSource({ source, file: `${tag}.sql` });
        for (const statement of sql.split('--> statement-breakpoint')) {
            if (statement.trim().length > 0) await client.query(statement);
        }
    }
    return journal.entries.length;
}

/** Creates an empty scratch database. Only databases created here are ever dropped. */
export async function createScratch({
    admin,
    name
}: {
    readonly admin: PgClient;
    readonly name: string;
}): Promise<void> {
    await admin.query(`CREATE DATABASE "${name}"`);
}

/** Drops a scratch database this test created. */
export async function dropScratch({
    admin,
    name
}: {
    readonly admin: PgClient;
    readonly name: string;
}): Promise<void> {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
}

/** Per-table row count and content hash of every public table: a fingerprint of the whole database. */
export async function fingerprint({
    client
}: {
    readonly client: PgClient;
}): Promise<Readonly<Record<string, string>>> {
    const tables = await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    const out: Record<string, string> = {};
    for (const row of tables.rows) {
        const table = String(row.tablename);
        const result = await client.query(
            `SELECT count(*)::text AS n, coalesce(md5(string_agg(t::text, '' ORDER BY t::text)), '') AS h FROM "${table}" t`
        );
        out[table] = `${String(result.rows[0]?.n)}:${String(result.rows[0]?.h)}`;
    }
    return out;
}
