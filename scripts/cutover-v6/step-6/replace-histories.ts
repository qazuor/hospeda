import { execFileSync } from 'node:child_process';
import { copyFileSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { GeneratedBaseline } from './generate-baseline.ts';

/** Filesystem effects planned or completed by the repository replacement. */
export interface ReplaceHistoriesResult {
    /** Removed numbered migration SQL files. */
    readonly removedMigrations: readonly string[];
    /** Removed numbered seed migration modules. */
    readonly removedSeedModules: readonly string[];
    /** Files left directly in the seed migration folder. */
    readonly keptInSeedDir: readonly string[];
    /** Tracked repository files needing review/update for the cutover commit. */
    readonly staleReferences: readonly string[];
}

/** Plans, or performs, replacement of both migration histories and the G8 switch. */
export function replaceHistories({
    repoRoot,
    baseline,
    referenceSql,
    dryRun
}: {
    readonly repoRoot: string;
    readonly baseline: GeneratedBaseline;
    readonly referenceSql: string;
    readonly dryRun: boolean;
}): ReplaceHistoriesResult {
    const migrationsDir = path.join(repoRoot, 'packages/db/src/migrations');
    const seedDir = path.join(repoRoot, 'packages/seed/src/data-migrations');
    const guardPath = path.join(repoRoot, 'scripts/check-old-grouping-word.sh');
    const migrations = readdirSync(migrationsDir);
    const seed = readdirSync(seedDir);
    const removedMigrations = migrations.filter((file) => /^\d{4}_.*\.sql$/.test(file)).sort();
    const removedSeedModules = seed.filter((file) => /^\d{4}-.*\.ts$/.test(file)).sort();
    const keptInSeedDir = seed.filter((file) => !removedSeedModules.includes(file)).sort();
    const staleReferences = findStaleReferences({ repoRoot, removedSeedModules });
    if (dryRun) return { removedMigrations, removedSeedModules, keptInSeedDir, staleReferences };

    const dirty = execFileSync(
        'git',
        [
            'status',
            '--porcelain',
            '--',
            'packages/db/src/migrations',
            'packages/seed/src/data-migrations',
            'scripts/check-old-grouping-word.sh'
        ],
        { cwd: repoRoot, encoding: 'utf8' }
    );
    if (dirty.trim())
        throw new Error(`Refusing to replace histories with protected paths modified:\n${dirty}`);

    const journal = JSON.parse(awaitlessRead(baseline.journalPath)) as {
        entries: { readonly idx: number; readonly tag: string }[];
    };
    if (
        journal.entries.length !== 1 ||
        journal.entries[0]?.tag !== baseline.tag ||
        journal.entries[0]?.idx !== 0
    )
        throw new Error('Baseline journal must contain exactly the expected entry at index zero');
    const generatedSql = path.join(path.dirname(baseline.journalPath), '..', `${baseline.tag}.sql`);
    const baselineSql = awaitlessRead(generatedSql);
    const baselineSnapshot = awaitlessRead(baseline.snapshotPath);
    const rewrittenGuard = rewriteStep6Guard({ guard: awaitlessRead(guardPath) });

    for (const file of removedMigrations) rmSync(path.join(migrationsDir, file));
    for (const file of readdirSync(path.join(migrationsDir, 'meta')))
        rmSync(path.join(migrationsDir, 'meta', file), { recursive: true, force: true });
    writeFileSync(
        path.join(migrationsDir, `${baseline.tag}.sql`),
        `${baselineSql.trim()}\n--> statement-breakpoint\n${referenceSql}\n`
    );
    copyFileSync(baseline.journalPath, path.join(migrationsDir, 'meta/_journal.json'));
    writeFileSync(path.join(migrationsDir, 'meta/0000_snapshot.json'), baselineSnapshot);
    for (const file of removedSeedModules) rmSync(path.join(seedDir, file));
    writeFileSync(guardPath, rewrittenGuard);
    return { removedMigrations, removedSeedModules, keptInSeedDir, staleReferences };
}

/** Finds tracked files naming removed modules or documenting the pre-step-6 G8 state. */
function findStaleReferences({
    repoRoot,
    removedSeedModules
}: {
    readonly repoRoot: string;
    readonly removedSeedModules: readonly string[];
}): readonly string[] {
    const paths = new Set<string>();
    for (const module of removedSeedModules) {
        try {
            const hits = execFileSync(
                'git',
                ['grep', '-Il', '-e', module, '--', ':!scripts/cutover-v6'],
                { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
            );
            for (const line of hits.split('\n').filter(Boolean)) paths.add(line);
        } catch {
            /* git grep exit 1 means no matches */
        }
    }
    for (const phrase of ['both constants ship off']) {
        try {
            const hits = execFileSync('git', ['grep', '-Il', '-e', phrase, '--', 'scripts'], {
                cwd: repoRoot,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            });
            for (const line of hits.split('\n').filter(Boolean)) paths.add(line);
        } catch {
            /* no stale text */
        }
    }
    return [...paths].sort();
}

/** Reads a UTF-8 file without introducing another runtime dependency. */
function awaitlessRead(file: string): string {
    return readFileSync(file, 'utf8');
}

function rewriteStep6Guard({ guard }: { readonly guard: string }): string {
    const rewritten = guard
        .replace('STEP6_RULE=off', 'STEP6_RULE=on')
        .replace(
            /ALLOWLIST=\(\n\s*"\$HISTORY_DB"\n\s*"\$HISTORY_SEED"\n\s*"\$PROGRAM_SPECS"\n\)/,
            'ALLOWLIST=(\n    "$PROGRAM_SPECS"\n)'
        );
    if (
        !rewritten.includes('STEP6_RULE=on') ||
        rewritten.includes('"$HISTORY_DB"\n') ||
        rewritten.includes('"$HISTORY_SEED"\n')
    )
        throw new Error('Could not safely update the G8 step 6 rule');
    return rewritten;
}
