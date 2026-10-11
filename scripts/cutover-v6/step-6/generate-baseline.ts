import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Resulting generated Drizzle baseline files and journal metadata. */
export interface GeneratedBaseline {
    /** Generated migration SQL path. */
    readonly sqlPath: string;
    /** Generated Drizzle journal path. */
    readonly journalPath: string;
    /** Generated snapshot path. */
    readonly snapshotPath: string;
    /** Drizzle journal tag. */
    readonly tag: string;
    /** Drizzle journal timestamp. */
    readonly when: number;
}

/** Runs drizzle-kit offline using a temporary config; the repository migrations directory is never an output. */
export function generateBaselineMigration({
    outDir,
    name = 'baseline'
}: {
    readonly outDir: string;
    readonly name?: string;
}): GeneratedBaseline {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const dbRoot = path.join(repoRoot, 'packages/db');
    const target = path.resolve(outDir);
    const configBase = path.join(repoRoot, '.hoja/tmp');
    mkdirSync(configBase, { recursive: true });
    const configDir = mkdtempSync(path.join(configBase, 'hospeda-v6-config-'));
    const configPath = path.join(configDir, 'drizzle.config.ts');
    const config = `import type { Config } from 'drizzle-kit';\nexport default { schema: ${JSON.stringify(path.join(dbRoot, 'src/schemas'))}, out: ${JSON.stringify(target)}, dialect: 'postgresql', tablesFilter: ['!search_index'] } satisfies Config;\n`;
    try {
        writeFileSync(configPath, config);
        const result = spawnSync(
            'pnpm',
            ['exec', 'drizzle-kit', 'generate', '--config', configPath, '--name', name],
            { cwd: dbRoot, input: '', encoding: 'utf8' }
        );
        const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
        if (result.error || result.status !== 0)
            throw new Error(
                `drizzle-kit generate failed: ${output || result.error?.message || 'unknown error'}`
            );
        if (output.includes('Error:'))
            throw new Error(`drizzle-kit reported Error: despite its exit status: ${output}`);
        const migrations = path.join(target, 'meta');
        const journal = JSON.parse(
            readFileSync(path.join(migrations, '_journal.json'), 'utf8')
        ) as { entries: { idx: number; tag: string; when: number }[] };
        if (journal.entries.length !== 1)
            throw new Error(
                `Expected one generated baseline journal entry, found ${journal.entries.length}`
            );
        const entry = journal.entries[0];
        if (!entry) throw new Error('Generated baseline journal entry is missing');
        const snapshots = readdirSync(migrations).filter((file) =>
            /^\d{4}_snapshot\.json$/.test(file)
        );
        const sqlPath = path.join(target, `${entry.tag}.sql`);
        const snapshotPath = path.join(
            migrations,
            `${entry.idx.toString().padStart(4, '0')}_snapshot.json`
        );
        if (snapshots.length !== 1 || !readFileSync(sqlPath, 'utf8'))
            throw new Error('Generated baseline SQL or snapshot is missing');
        return {
            sqlPath,
            journalPath: path.join(migrations, '_journal.json'),
            snapshotPath,
            tag: entry.tag,
            when: entry.when
        };
    } finally {
        rmSync(configDir, { recursive: true, force: true });
    }
}
