import { execFileSync as nodeExecFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `runReconciliationSweep` defaults to the leased `cycle` mode. `mode: 'single'` is a test-only
 * escape hatch: its run has no cycle id, so it bypasses the partial unique "one open slice"
 * index of migration 0187 (`cycle_id IS NOT NULL`). Production source must never request it.
 */
const root = resolve(__dirname, '../../../..');
/** The only production files allowed to name the `single` literal: its definition and its handling. */
const ALLOWED = new Set([
    'packages/service-core/src/services/billing/reconciliation/sweep/reconciliation-sweep.types.ts',
    'packages/service-core/src/services/billing/reconciliation/sweep/reconciliation-sweep.service.ts'
]);
const PRODUCTION =
    /^(?:(?:packages|apps)\/[^/]+\/(?:src|scripts)|scripts)\/.+\.(?:ts|tsx|mts|cts|js|mjs)$/;
const TEST_PATH = /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;
const MODE_SINGLE = /\bmode\s*:\s*['"`]single['"`]/;
const SINGLE_LITERAL = /['"`]single['"`]/;
const SWEEP_CALL = /\brunReconciliationSweep\b/;

function violations(files: readonly { path: string; source: string }[]): string[] {
    return files
        .filter(({ path }) => PRODUCTION.test(path) && !TEST_PATH.test(path))
        .filter(({ path }) => !ALLOWED.has(path))
        .filter(
            ({ source }) =>
                MODE_SINGLE.test(source) || (SWEEP_CALL.test(source) && SINGLE_LITERAL.test(source))
        )
        .map(({ path }) => `${path}: the sweep's 'single' mode is test-only`);
}

describe('sweep single mode guard', () => {
    it('keeps the single mode out of production source', () => {
        const output = nodeExecFileSync(
            'git',
            [
                'ls-files',
                '--cached',
                '--others',
                '--exclude-standard',
                '--',
                ':(glob)packages/*/src/**',
                ':(glob)packages/*/scripts/**',
                ':(glob)apps/*/src/**',
                ':(glob)apps/*/scripts/**',
                'scripts'
            ],
            { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
        );
        const paths = output.split('\n').filter((path) => PRODUCTION.test(path));
        expect(paths.length).toBeGreaterThan(100);
        for (const path of ALLOWED) expect(paths).toContain(path);
        expect(
            violations(
                paths.map((path) => ({ path, source: readFileSync(join(root, path), 'utf8') }))
            )
        ).toEqual([]);
    });

    it('flags mode single in a production caller', () => {
        expect(
            violations([
                {
                    path: 'apps/api/src/cron/jobs/x.ts',
                    source: "await runReconciliationSweep({ mode: 'single' }, ports);"
                }
            ])
        ).toHaveLength(1);
    });

    it('flags the single literal passed through a variable next to the sweep call', () => {
        expect(
            violations([
                {
                    path: 'apps/api/src/cron/jobs/x.ts',
                    source: "const m = 'single'; await runReconciliationSweep({ mode: m }, ports);"
                }
            ])
        ).toHaveLength(1);
    });

    it('ignores test files', () => {
        expect(
            violations([
                {
                    path: 'packages/service-core/test/integration/services/a.test.ts',
                    source: "runReconciliationSweep({ mode: 'single' }, ports)"
                }
            ])
        ).toEqual([]);
    });
});
