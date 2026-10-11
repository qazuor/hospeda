import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface LedgerClient {
    query(
        sql: string,
        params?: readonly unknown[]
    ): Promise<{ rows: readonly Record<string, unknown>[] }>;
}

export interface BaselineEntry {
    readonly tag: string;
    readonly when: number;
    readonly hash: string;
}

export interface LedgerBackups {
    readonly migrations: string;
    readonly seed: string;
    readonly migrationsCount: number;
    readonly seedCount: number;
}

/**
 * Drizzle decides whether to apply the baseline by comparing the latest
 * `created_at` with the journal's `when`; the hash records the SQL contents,
 * but does not participate in that pending-migration decision.
 */
export function readBaselineEntry({
    migrationsDir
}: {
    readonly migrationsDir: string;
}): BaselineEntry {
    const journal = JSON.parse(
        readFileSync(path.join(migrationsDir, 'meta/_journal.json'), 'utf8')
    ) as {
        entries: { tag: string; when: number }[];
    };
    if (journal.entries.length !== 1)
        throw new Error(
            `Expected exactly one baseline journal entry; found ${journal.entries.length}`
        );
    const entry = journal.entries[0];
    if (!entry || !Number.isSafeInteger(entry.when) || !entry.tag)
        throw new Error('Baseline journal entry is invalid');
    const sql = readFileSync(path.join(migrationsDir, `${entry.tag}.sql`), 'utf8');
    return {
        tag: entry.tag,
        when: entry.when,
        hash: createHash('sha256').update(sql).digest('hex')
    };
}

const equalRows = async (client: LedgerClient, left: string, right: string): Promise<boolean> => {
    const result = await client.query(
        `SELECT NOT EXISTS ((TABLE ${left} EXCEPT ALL TABLE ${right}) UNION ALL (TABLE ${right} EXCEPT ALL TABLE ${left})) AS equal`
    );
    return result.rows[0]?.equal === true;
};

async function rowCount(client: LedgerClient, table: string): Promise<number> {
    const result = await client.query(`SELECT count(*)::int AS count FROM ${table}`);
    return Number(result.rows[0]?.count);
}

function backupNames(now: Date): { migrations: string; seed: string } {
    const stamp = now
        .toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, 17);
    return {
        migrations: `drizzle.__drizzle_migrations_bak_${stamp}`,
        seed: `public.seed_migrations_bak_${stamp}`
    };
}

export async function rewriteLedgers({
    client,
    entry,
    now = new Date(),
    beforeCommit,
    afterCommitVerify
}: {
    readonly client: LedgerClient;
    readonly entry: BaselineEntry;
    readonly now?: Date;
    readonly beforeCommit?: () => Promise<void>;
    readonly afterCommitVerify?: () => Promise<void>;
}): Promise<LedgerBackups & { readonly restoredAfterVerificationFailure: boolean }> {
    const backup = backupNames(now);
    const mig = backup.migrations;
    const seed = backup.seed;
    const counts = { migrationsCount: 0, seedCount: 0 };
    await client.query('BEGIN');
    try {
        const exists = await client.query(
            `SELECT to_regclass('drizzle.__drizzle_migrations') AS migrations, to_regclass('public.seed_migrations') AS seed, to_regclass('public.cutover_v6_deleted_listing') AS passage`
        );
        if (!exists.rows[0]?.migrations || !exists.rows[0]?.seed)
            throw new Error('Required migration ledger table is missing');
        if (exists.rows[0]?.passage)
            throw new Error(
                'Refusing ledger rewrite while cutover_v6_deleted_listing still exists'
            );
        counts.migrationsCount = await rowCount(client, 'drizzle.__drizzle_migrations');
        counts.seedCount = await rowCount(client, 'public.seed_migrations');
        if (counts.migrationsCount === 0)
            throw new Error('Refusing to rewrite an empty drizzle migration ledger');
        for (const table of [mig, seed]) {
            const old = await client.query('SELECT to_regclass($1) AS exists', [table]);
            if (old.rows[0]?.exists) throw new Error(`Backup table already exists: ${table}`);
        }
        await client.query(`CREATE TABLE ${mig} AS TABLE drizzle.__drizzle_migrations`);
        await client.query(`CREATE TABLE ${seed} AS TABLE public.seed_migrations`);
        if (
            (await rowCount(client, mig)) !== counts.migrationsCount ||
            (await rowCount(client, seed)) !== counts.seedCount
        )
            throw new Error('Ledger backup row count does not match the original');
        await client.query('TRUNCATE drizzle.__drizzle_migrations RESTART IDENTITY');
        await client.query(
            'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
            [entry.hash, entry.when]
        );
        await client.query('TRUNCATE public.seed_migrations');
        const inserted = await client.query(
            'SELECT hash, created_at FROM drizzle.__drizzle_migrations'
        );
        if (
            inserted.rows.length !== 1 ||
            inserted.rows[0]?.hash !== entry.hash ||
            Number(inserted.rows[0]?.created_at) !== entry.when
        )
            throw new Error('Written baseline ledger row failed verification');
        if ((await rowCount(client, 'public.seed_migrations')) !== 0)
            throw new Error('Seed ledger was not emptied');
        await beforeCommit?.();
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
    }
    try {
        await afterCommitVerify?.();
        const verify = await client.query(
            'SELECT hash, created_at FROM drizzle.__drizzle_migrations'
        );
        if (
            verify.rows.length !== 1 ||
            verify.rows[0]?.hash !== entry.hash ||
            Number(verify.rows[0]?.created_at) !== entry.when
        )
            throw new Error('Post-commit migration ledger verification failed');
        if ((await rowCount(client, 'public.seed_migrations')) !== 0)
            throw new Error('Post-commit seed ledger verification failed');
        return { ...backup, ...counts, restoredAfterVerificationFailure: false };
    } catch (error) {
        await restoreLedgers({ client, backups: { ...backup, ...counts } });
        throw new Error(
            `Post-commit verification failed; original ledgers were restored: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

export async function restoreLedgers({
    client,
    backups
}: {
    readonly client: LedgerClient;
    readonly backups: LedgerBackups;
}): Promise<void> {
    await client.query('BEGIN');
    try {
        const present = await client.query(
            `SELECT to_regclass($1) AS migrations, to_regclass($2) AS seed`,
            [backups.migrations, backups.seed]
        );
        if (!present.rows[0]?.migrations || !present.rows[0]?.seed)
            throw new Error('Both ledger backups must exist to restore');
        await client.query('TRUNCATE drizzle.__drizzle_migrations RESTART IDENTITY');
        await client.query(
            `INSERT INTO drizzle.__drizzle_migrations SELECT * FROM ${backups.migrations}`
        );
        await client.query('TRUNCATE public.seed_migrations');
        await client.query(`INSERT INTO public.seed_migrations SELECT * FROM ${backups.seed}`);
        const sequence = await client.query(
            "SELECT pg_get_serial_sequence('drizzle.__drizzle_migrations', 'id') AS name"
        );
        const sequenceName = sequence.rows[0]?.name;
        if (typeof sequenceName === 'string') {
            const maxId = await client.query(
                'SELECT max(id)::bigint AS max_id FROM drizzle.__drizzle_migrations'
            );
            const lastId = maxId.rows[0]?.max_id;
            await client.query('SELECT setval($1::regclass, $2, $3)', [
                sequenceName,
                lastId ?? 1,
                lastId != null
            ]);
        }
        if (
            !(await equalRows(client, 'drizzle.__drizzle_migrations', backups.migrations)) ||
            !(await equalRows(client, 'public.seed_migrations', backups.seed))
        )
            throw new Error('Restored ledgers differ row by row from their backups');
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
    }
}
