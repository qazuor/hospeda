/**
 * TEST:V9b:14 — verifies AC:V9b:14's clause that the diff does not touch PB4/PB5 code.
 * This is a hash freeze rather than a diff because H17 leaves no Phase 1 base branch; the hashes
 * are measured at the epic tip. A future V6 sheet that must change a frozen file updates its hash
 * visibly in that sheet's PR, so the exception remains reviewable.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RETENTION_ARCHIVE_INVENTORY_PATH = 'scripts/guards/retention-archive-untouched.json';
export const FROZEN_FILES = [
    'packages/verticals/src/publication/archive-inactive-listing.ts',
    'packages/verticals/src/publication/archive-notices.ts',
    'packages/verticals/src/publication/inactivity-archive-run.ts',
    'packages/verticals/src/publication/retention-clock.ts',
    'packages/db/src/models/listing/listing-retention.model.ts',
    'apps/api/src/cron/jobs/listing-inactivity-archive.job.ts',
    'apps/api/src/utils/listing-publication/archive-ports.ts',
    'packages/notifications/src/services/outbox/listing-archived-renderers.tsx',
    'packages/notifications/src/templates/listing/listing-archived.tsx'
] as const;

interface InventoryRow {
    readonly file: string;
    readonly sha256: string;
}

function fail(message: string): string {
    return `FAIL TEST:V9b:14 AC:V9b:14: ${message}`;
}

/** Run the PB4/PB5 freeze against a repository root and optional inventory file. */
export function run(args: { readonly root?: string; readonly inventoryPath?: string } = {}): {
    readonly exitCode: number;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const inventoryPath = args.inventoryPath ?? join(root, RETENTION_ARCHIVE_INVENTORY_PATH);
    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(inventoryPath, 'utf8'));
    } catch {
        return {
            exitCode: 1,
            output: fail(`inventory ${RETENTION_ARCHIVE_INVENTORY_PATH} is unreadable JSON`)
        };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { exitCode: 1, output: fail('inventory must be a JSON object') };
    }
    const data = parsed as Record<string, unknown>;
    const problems: string[] = [];
    if (typeof data.spec !== 'string' || !/(?:^|\/)[^/]+\.md:\d+(?:-\d+)?/.test(data.spec)) {
        problems.push(fail('inventory spec must cite archivo.md:línea'));
    }
    if (typeof data.measuredAt !== 'string' || data.measuredAt.trim().length === 0) {
        problems.push(fail('inventory measuredAt is missing'));
    }
    if (!Array.isArray(data.files)) {
        problems.push(fail('inventory files must be an array'));
        return { exitCode: 1, output: problems.join('\n') };
    }
    const rows: InventoryRow[] = [];
    const seen = new Set<string>();
    for (const raw of data.files) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            problems.push(fail('inventory row must contain file and sha256'));
            continue;
        }
        const row = raw as Record<string, unknown>;
        if (typeof row.file !== 'string' || row.file.length === 0) {
            problems.push(fail('inventory row has no file'));
            continue;
        }
        if (seen.has(row.file)) problems.push(fail(`inventory repeats ${row.file}`));
        seen.add(row.file);
        if (typeof row.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(row.sha256)) {
            problems.push(fail(`inventory ${row.file} has sha256 that is not 64 hex characters`));
            continue;
        }
        rows.push({ file: row.file, sha256: row.sha256.toLowerCase() });
    }
    for (let i = 0; i < FROZEN_FILES.length; i++) {
        if (rows[i]?.file !== FROZEN_FILES[i]) {
            problems.push(fail(`inventory is missing or out of order at ${FROZEN_FILES[i]}`));
        }
    }
    if (rows.length !== FROZEN_FILES.length || data.files.length !== FROZEN_FILES.length) {
        const absent = FROZEN_FILES.filter((file) => !seen.has(file));
        for (const file of absent) problems.push(fail(`inventory is missing ${file}`));
        if (absent.length === 0)
            problems.push(fail('inventory must list exactly the nine frozen files'));
    }
    if (problems.length > 0) return { exitCode: 1, output: [...new Set(problems)].join('\n') };

    for (const row of rows) {
        const path = join(root, row.file);
        if (!existsSync(path)) {
            problems.push(fail(`${row.file} is missing`));
            continue;
        }
        const found = createHash('sha256').update(readFileSync(path)).digest('hex');
        if (found !== row.sha256) {
            problems.push(
                fail(
                    `${row.file} changed (PB4/PB5 code is frozen for V9b; expected ${row.sha256}, found ${found})`
                )
            );
        }
    }
    if (problems.length > 0) return { exitCode: 1, output: problems.join('\n') };
    return {
        exitCode: 0,
        output: `OK TEST:V9b:14: 9 PB4/PB5 files unchanged since ${data.measuredAt as string}`
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
