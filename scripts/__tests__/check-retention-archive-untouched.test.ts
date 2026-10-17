/** TEST:V9b:14 — the frozen PB4/PB5 code is checked by its source hashes. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    FROZEN_FILES,
    RETENTION_ARCHIVE_INVENTORY_PATH,
    run
} from '../check-retention-archive-untouched';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INVENTORY = readFileSync(path.join(REPO_ROOT, RETENTION_ARCHIVE_INVENTORY_PATH), 'utf8');
const TEMP_DIRS: string[] = [];

afterEach(() => {
    for (const dir of TEMP_DIRS.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeTree(
    options: { readonly omit?: readonly string[]; readonly inventory?: string } = {}
) {
    const root = mkdtempSync(path.join(tmpdir(), 'test-v9b-14-'));
    TEMP_DIRS.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    const files: Record<string, string> = {
        [RETENTION_ARCHIVE_INVENTORY_PATH]: options.inventory ?? INVENTORY,
        ...Object.fromEntries(
            FROZEN_FILES.map((file) => [file, readFileSync(path.join(REPO_ROOT, file), 'utf8')])
        )
    };
    for (const file of options.omit ?? []) delete files[file];
    for (const [file, content] of Object.entries(files)) {
        const fullPath = path.join(root, file);
        mkdirSync(path.dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, content);
    }
    return root;
}

describe('TEST:V9b:14 PB4/PB5 freeze guard', () => {
    it('accepts the repository tree', () => {
        const result = run();
        expect(result.exitCode).toBe(0);
        expect(result.output).toBe('OK TEST:V9b:14: 9 PB4/PB5 files unchanged since 9c81cf562c');
    });

    it.each([
        'packages/verticals/src/publication/archive-inactive-listing.ts',
        'packages/notifications/src/templates/listing/listing-archived.tsx'
    ])('names a changed file: %s', (file) => {
        const root = makeTree();
        writeFileSync(
            path.join(root, file),
            `${readFileSync(path.join(root, file), 'utf8')}\n// mutation\n`
        );
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL TEST:V9b:14 AC:V9b:14: ${file} changed`);
    });

    it('names a missing source file', () => {
        const file = 'packages/verticals/src/publication/inactivity-archive-run.ts';
        const result = run({ root: makeTree({ omit: [file] }) });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL TEST:V9b:14 AC:V9b:14: ${file} is missing`);
    });

    it('rejects an inventory row removed from the JSON and names the missing file', () => {
        const inventory = JSON.parse(INVENTORY) as { files: { file: string; sha256: string }[] };
        inventory.files = inventory.files.filter(
            (row) => row.file !== 'packages/verticals/src/publication/retention-clock.ts'
        );
        const result = run({ root: makeTree({ inventory: JSON.stringify(inventory) }) });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            'inventory is missing packages/verticals/src/publication/retention-clock.ts'
        );
    });

    it('rejects a non-hex SHA-256', () => {
        const inventory = JSON.parse(INVENTORY) as { files: { file: string; sha256: string }[] };
        inventory.files[0]!.sha256 = 'not-a-hash';
        const result = run({ root: makeTree({ inventory: JSON.stringify(inventory) }) });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `inventory ${FROZEN_FILES[0]} has sha256 that is not 64 hex characters`
        );
    });

    it('is wired before check:role-never-decides and last check:fake-lies, and in CI guards', () => {
        const scripts = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'))
            .scripts as Record<string, string>;
        expect(scripts['check:retention-archive-untouched']).toBe(
            'tsx scripts/check-retention-archive-untouched.ts'
        );
        const guards = scripts['check:guards'] ?? '';
        expect(guards.indexOf('pnpm check:retention-archive-untouched')).toBeLessThan(
            guards.indexOf('pnpm check:role-never-decides')
        );
        expect(guards.trim().endsWith('pnpm check:fake-lies')).toBe(true);
        const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');
        const guardsJob = ci.split('\n  guards:\n')[1]?.split(/\n {2}[a-zA-Z][\w-]*:\n/)[0];
        expect(guardsJob).toContain(
            '# TEST:V9b:14 (HOS-1504, AC:V9b:14). Its own step, like every guard here.'
        );
        expect(guardsJob).toContain('run: pnpm check:retention-archive-untouched');
    });
});
