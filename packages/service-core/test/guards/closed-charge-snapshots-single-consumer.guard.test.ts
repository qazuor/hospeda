import { execFileSync as nodeExecFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../..');
const ALLOWED = new Set([
    'packages/service-core/src/services/billing/reconciliation/period-charges/read-charge-inventory.ts',
    'packages/service-core/src/services/billing/reconciliation/charge-snapshots/closed-charge-snapshots.ts'
]);
const PRODUCTION_SOURCE = /^(packages|apps)\/[^/]+\/src\//;
const LOOKUP = /\bclosedChargeSnapshots\s*\.\s*find\s*\(/;
type GitRunner = typeof nodeExecFileSync;

function findViolations(files: readonly { readonly path: string; readonly source: string }[]) {
    return files.flatMap(({ path, source }) =>
        LOOKUP.test(source) && !ALLOWED.has(path)
            ? [`${path}: closedChargeSnapshots.find is reserved for readChargeInventory`]
            : []
    );
}

function candidates(execFileSync: GitRunner = nodeExecFileSync): readonly string[] {
    try {
        return execFileSync(
            'git',
            [
                'grep',
                '-l',
                '--untracked',
                '-E',
                'closedChargeSnapshots[[:space:]]*\\.[[:space:]]*find',
                '--',
                'packages',
                'apps'
            ],
            { cwd: root, encoding: 'utf8' }
        )
            .split('\n')
            .filter((path) => PRODUCTION_SOURCE.test(path));
    } catch (error) {
        if ((error as { status?: number }).status === 1) return [];
        if ((error as { code?: string }).code === 'ENOENT')
            throw new Error('closed-charge-snapshots guard needs git on PATH');
        throw error;
    }
}

describe('closed charge snapshot single consumer guard', () => {
    it('allows only the inventory reader and port implementation', () => {
        const files = candidates();
        const implementation =
            'packages/service-core/src/services/billing/reconciliation/charge-snapshots/closed-charge-snapshots.ts';
        expect(files).toContain(
            'packages/service-core/src/services/billing/reconciliation/period-charges/read-charge-inventory.ts'
        );
        expect(
            findViolations([
                ...files.map((path) => ({ path, source: readFileSync(join(root, path), 'utf8') })),
                { path: implementation, source: readFileSync(join(root, implementation), 'utf8') }
            ])
        ).toEqual([]);
    });

    it('flags a synthetic second consumer', () => {
        expect(
            findViolations([
                {
                    path: 'packages/service-core/src/other.ts',
                    source: 'closedChargeSnapshots.find({ chargeIds })'
                }
            ])
        ).toHaveLength(1);
    });
});
