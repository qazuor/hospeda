import { execFileSync as nodeExecFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../..');
const ALLOWED = new Set([
    'packages/service-core/src/services/billing/reconciliation/sweep/reconciliation-sweep.service.ts',
    'packages/service-core/src/services/billing/reconciliation/sweep/sweep-slice-open.ts',
    'packages/db/src/models/reconciliation-sweep-run/reconciliation-sweep-run.model.ts',
    'packages/db/src/schemas/vertical/reconciliation-sweep-run.dbschema.ts'
]);
const SOURCE = /^(packages|apps)\/[^/]+\/src\//;
const IDENTIFIER = /\bpassesCompleted\s*:|\bpasses_completed\b/;

function violations(files: readonly { path: string; source: string }[]): string[] {
    return files
        .filter(
            ({ path, source }) => SOURCE.test(path) && IDENTIFIER.test(source) && !ALLOWED.has(path)
        )
        .map(
            ({ path }) =>
                `${path}: passes_completed writes are restricted to sweep progress infrastructure`
        );
}

describe('passes completed writer guard', () => {
    it('allows production writers only at the guarded progress boundaries', () => {
        const output = nodeExecFileSync(
            'git',
            [
                'grep',
                '-l',
                '--untracked',
                '-E',
                'passesCompleted[[:space:]]*:|passes_completed',
                '--',
                'packages',
                'apps'
            ],
            { cwd: root, encoding: 'utf8' }
        );
        const paths = output
            .split('\n')
            .filter((path) => SOURCE.test(path) && path.endsWith('.ts'));
        for (const path of ALLOWED) expect(paths).toContain(path);
        expect(
            violations(
                paths.map((path) => ({ path, source: readFileSync(join(root, path), 'utf8') }))
            )
        ).toEqual([]);
    });

    it('flags a second writer', () => {
        expect(
            violations([{ path: 'apps/api/src/cron/other.ts', source: 'passesCompleted: []' }])
        ).toHaveLength(1);
    });
});
