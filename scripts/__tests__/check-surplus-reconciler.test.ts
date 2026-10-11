/** TEST:V6:6 — GUARD:G5 detects source writers without surplus reconciliation. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-surplus-reconciler';

const roots: string[] = [];
afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const baseFiles = {
    'apps/api/src/index.ts':
        "import { subscribeListingCoverageRecalculation } from './listener'; subscribeListingCoverageRecalculation();",
    'apps/api/src/utils/listing-publication/coverage-listener.ts': 'recalculateCoverage();',
    'packages/service-core/src/writer.ts':
        "import { trials } from '@repo/db'; export async function turnOff() { await db.update(trials).set({ status: 'TRIAL_EXPIRED' }); recalculateCoverage(); }"
};
function tree(files: Readonly<Record<string, string>> = baseFiles): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g5-'));
    roots.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, source] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), source);
    }
    return root;
}
const writer = {
    file: 'packages/service-core/src/writer.ts',
    symbol: 'turnOff',
    table: 'trials',
    effect: 'turns-off',
    via: 'notice',
    reason: 'test'
} as const;
function check(files = baseFiles, inventory = [writer], minimum = 1) {
    return run({ root: tree(files), inventory, minScannedFiles: minimum });
}

describe('TEST:V6:6 GUARD:G5', () => {
    it('accepts the repository tree', () => {
        expect(run().exitCode).toBe(0);
    });
    it('accepts a notice-backed turn-off', () => {
        expect(check().exitCode).toBe(0);
    });
    it('rejects the mutation that removes its reconciler call', () => {
        const result = check({
            ...baseFiles,
            [writer.file]:
                "export async function turnOff() { await db.update(trials).set({ status: 'TRIAL_EXPIRED' }); }"
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('G5: packages/service-core/src/writer.ts:1');
    });
    it('rejects an unlisted writer', () => {
        expect(check(baseFiles, []).output).toContain('source write is not inventoried');
    });
    it('rejects a stale entry', () => {
        expect(check({ ...baseFiles, [writer.file]: 'export const x = 1;' }).output).toContain(
            'stale inventory'
        );
    });
    it('rejects pending without owner', () => {
        expect(
            check(baseFiles, [{ ...writer, via: 'pending', owner: undefined }]).output
        ).toContain('has no owner');
    });
    it('rejects pending over ceiling', () => {
        expect(
            check(
                baseFiles,
                Array.from({ length: 8 }, (_, i) => ({
                    ...writer,
                    file: `${writer.file}${i}`,
                    via: 'pending',
                    owner: 'owner'
                }))
            ).output
        ).toContain('exceed ceiling');
    });
    it('rejects missing cable wiring', () => {
        expect(
            check({
                ...baseFiles,
                'apps/api/src/index.ts': '',
                'apps/api/src/utils/listing-publication/coverage-listener.ts': ''
            }).output
        ).toContain('listener is not wired');
    });
    it('rejects an undersized scan', () => {
        expect(check(baseFiles, [writer], 20).output).toContain('expected at least 20');
    });
    it('allows a turn-on without via', () => {
        expect(check(baseFiles, [{ ...writer, effect: 'turns-on', via: null }]).exitCode).toBe(0);
    });
});
