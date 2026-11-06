import { execFileSync as nodeExecFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * HOS-1999 (spec §6.2, decision 2026-11-03): a stamped `ProviderRead` may be
 * shared only through `shareProviderReadForAct`, keyed by act identity, and its
 * only consumer is `readChargeForAct`. Raw-input memoization
 * (`memoizeInProviderReadScope`) stays inside `packages/payments/src`.
 *
 * `git grep` lists the candidate files (a full readdir walk of the monorepo
 * timed out in CI); each hit is then re-checked with a word-boundary regex.
 */
const root = resolve(__dirname, '../../../..');
const SHARE_ALLOWED = new Set([
    'packages/payments/src/provider/provider-read-scope.ts',
    'packages/payments/src/index.ts',
    'packages/service-core/src/services/billing/reconciliation/period-charges/read-charge-for-act.ts'
]);
/** Production source only: `packages/<name>/src/**` and `apps/<name>/src/**`. */
const PRODUCTION_SOURCE = /^(packages|apps)\/[^/]+\/src\//;
const IDENTIFIERS = /\b(shareProviderReadForAct|memoizeInProviderReadScope)\b/;

type GitRunner = typeof nodeExecFileSync;

function candidateFiles(execFileSync: GitRunner = nodeExecFileSync): readonly string[] {
    try {
        const output = execFileSync(
            'git',
            [
                'grep',
                '-l',
                '--untracked',
                '-E',
                'shareProviderReadForAct|memoizeInProviderReadScope',
                '--',
                'packages',
                'apps'
            ],
            { cwd: root, encoding: 'utf8' }
        );
        return output.split('\n').filter((line) => PRODUCTION_SOURCE.test(line));
    } catch (error) {
        // `git grep` exits 1 when nothing matches; anything else is a real failure.
        if ((error as { status?: number }).status === 1) return [];
        if ((error as { code?: string }).code === 'ENOENT')
            throw new Error(
                'share-provider-read-for-act guard needs git on PATH to list candidate files'
            );
        throw error;
    }
}

function findViolations(args: {
    readonly files: readonly { readonly path: string; readonly source: string }[];
}): readonly string[] {
    const violations: string[] = [];
    for (const { path, source } of args.files) {
        if (!IDENTIFIERS.test(source)) continue;
        if (/\bshareProviderReadForAct\b/.test(source) && !SHARE_ALLOWED.has(path))
            violations.push(
                `${path}: shareProviderReadForAct may only be used by readChargeForAct (spec §6.2)`
            );
        if (
            /\bmemoizeInProviderReadScope\b/.test(source) &&
            !path.startsWith('packages/payments/src/')
        )
            violations.push(
                `${path}: memoizeInProviderReadScope is internal to packages/payments/src`
            );
    }
    return violations;
}

describe('stamped provider read sharing guard (HOS-1999)', () => {
    it('limits stamped sharing to readChargeForAct and raw memoization to payments', () => {
        const files = candidateFiles();
        // The scan must reach the files the rule is about, or it proves nothing.
        for (const allowed of SHARE_ALLOWED) expect(files, allowed).toContain(allowed);

        const violations = findViolations({
            files: files.map((path) => ({ path, source: readFileSync(join(root, path), 'utf8') }))
        });
        expect(violations).toEqual([]);
    });

    it('reports planted violations and explains missing git (kills a vacuous guard)', () => {
        expect(
            findViolations({
                files: [
                    { path: 'packages/service-core/src/x.ts', source: 'shareProviderReadForAct()' },
                    { path: 'apps/api/src/y.ts', source: 'memoizeInProviderReadScope()' }
                ]
            })
        ).toHaveLength(2);
        const missingGit = Object.assign(new Error('missing'), { code: 'ENOENT' });
        const runner = (() => {
            throw missingGit;
        }) as unknown as GitRunner;
        expect(() => candidateFiles(runner)).toThrow(
            'share-provider-read-for-act guard needs git on PATH to list candidate files'
        );
    });
});
