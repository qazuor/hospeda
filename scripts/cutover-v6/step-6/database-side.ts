import { readFileSync, statSync } from 'node:fs';
import { type LedgerClient, readBaselineEntry, rewriteLedgers } from './ledgers.ts';
import { assertRehearsalMatches } from './rehearsal-gate.ts';
import type { SchemaClient } from './schema-fingerprint.ts';

type DatabaseClient = LedgerClient & SchemaClient & { end(): Promise<void> };

export async function requireFullBackup({
    confirmFullBackup
}: {
    readonly confirmFullBackup?: string;
}): Promise<void> {
    if (!confirmFullBackup)
        throw new Error('A non-empty --confirm-full-backup file path is required');
    try {
        if (!statSync(confirmFullBackup).isFile() || statSync(confirmFullBackup).size === 0)
            throw new Error('empty or not a file');
        // Ensure the operator-supplied path can actually be read without exposing its content.
        readFileSync(confirmFullBackup, { flag: 'r' });
    } catch {
        throw new Error('The full database backup must be an existing, readable, non-empty file');
    }
}

export async function runDatabaseSide({
    targetUrl,
    builtUrl,
    migrationsDir,
    confirmFullBackup,
    dryRun = false,
    connect
}: {
    readonly targetUrl: string;
    readonly builtUrl: string;
    readonly migrationsDir: string;
    readonly confirmFullBackup?: string;
    readonly dryRun?: boolean;
    readonly connect: (args: { readonly url: string }) => Promise<DatabaseClient>;
}): Promise<{
    readonly dryRun: boolean;
    readonly entry: ReturnType<typeof readBaselineEntry>;
    readonly backup?: Awaited<ReturnType<typeof rewriteLedgers>>;
}> {
    await requireFullBackup({ confirmFullBackup });
    const entry = readBaselineEntry({ migrationsDir });
    const target = await connect({ url: targetUrl });
    let built: DatabaseClient | undefined;
    try {
        built = await connect({ url: builtUrl });
        await assertRehearsalMatches({ cutClient: target, builtClient: built });
        if (dryRun) return { dryRun: true, entry };
        const backup = await rewriteLedgers({ client: target, entry });
        return { dryRun: false, entry, backup };
    } finally {
        await Promise.all([target.end(), built?.end()]);
    }
}
