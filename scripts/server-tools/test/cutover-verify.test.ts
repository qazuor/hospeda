/**
 * Unit tests for `hops cutover-verify` (HOS-1957): argv parsing, the deployed-SHA
 * guard ordering and the exact command the wrapped script runs. An injected fake
 * `Runner` stands in for `pnpm`; no Docker, database or process is touched.
 */

import { describe, expect, it } from 'bun:test';
import { CUTOVER_VERIFY_ARGV } from '../src/commands/cutover-verify.ts';
import { validateCommandFlags } from '../src/lib/cli-flags.ts';
import {
    type ExecuteCutoverVerifyInput,
    executeCutoverVerify,
    parseCutoverVerifyArgs
} from '../src/lib/cutover-verify-core.ts';
import type { Runner, RunOptions } from '../src/lib/runner.ts';

function fakeRunner(
    exitCode: number,
    calls: { argv: readonly string[]; options?: RunOptions }[]
): Runner {
    return {
        async run(argv, options) {
            calls.push({ argv, options });
            return { exitCode, stdout: '', stderr: '', failed: exitCode !== 0 };
        }
    };
}

const noopLog = { info() {}, warn() {} };

function baseInput(
    overrides: Partial<ExecuteCutoverVerifyInput> & { calls: { argv: readonly string[] }[] }
): ExecuteCutoverVerifyInput {
    const { calls, ...rest } = overrides;
    return {
        runner: fakeRunner(0, calls),
        repoRoot: '/repo',
        options: { journal: true, catalog: false, allowShaMismatch: false },
        containerEnv: ['NODE_ENV=production', 'HOSPEDA_COMMIT_SHA=abcdef0123456789'],
        databaseUrl: 'postgresql://host/db',
        hostEnv: { PATH: '/usr/bin' },
        readCheckoutSha: async () => 'abcdef0123456789ffff',
        log: noopLog,
        ...rest
    };
}

describe('parseCutoverVerifyArgs', () => {
    it('requires at least one check', () => {
        expect(parseCutoverVerifyArgs([]).ok).toBe(false);
        expect(parseCutoverVerifyArgs(['--allow-sha-mismatch']).ok).toBe(false);
    });

    it('accepts either check or both', () => {
        const result = parseCutoverVerifyArgs(['--journal', '--catalog']);
        expect(result).toEqual({
            ok: true,
            value: { journal: true, catalog: true, allowShaMismatch: false }
        });
    });

    it('refuses unknown and repeated flags', () => {
        expect(parseCutoverVerifyArgs(['--journal', '--yes']).ok).toBe(false);
        expect(parseCutoverVerifyArgs(['--journal', '--journal']).ok).toBe(false);
    });
});

describe('CUTOVER_VERIFY_ARGV', () => {
    it('declares exactly the flags the parser knows', () => {
        // Arrange / Act
        const known = validateCommandFlags({
            argv: ['--journal', '--catalog', '--allow-sha-mismatch'],
            spec: CUTOVER_VERIFY_ARGV
        });
        const unknown = validateCommandFlags({
            argv: ['--write'],
            spec: CUTOVER_VERIFY_ARGV
        });

        // Assert
        expect(known.unknown).toEqual([]);
        expect(unknown.unknown).toEqual([{ flag: '--write' }]);
    });
});

describe('executeCutoverVerify', () => {
    it('runs the script with only the requested checks and returns its exit code', async () => {
        // Arrange
        const calls: { argv: readonly string[]; options?: RunOptions }[] = [];

        // Act
        const result = await executeCutoverVerify(
            baseInput({
                calls,
                runner: fakeRunner(1, calls),
                options: { journal: true, catalog: true, allowShaMismatch: false }
            })
        );

        // Assert
        expect(result).toEqual({ ok: true, exitCode: 1 });
        expect(calls).toHaveLength(1);
        expect(calls[0]?.argv).toEqual([
            'pnpm',
            '--dir',
            'apps/api',
            'exec',
            'tsx',
            'scripts/cutover-v6-verify.ts',
            '--journal',
            '--catalog'
        ]);
        expect(calls[0]?.options?.inheritEnv).toBe(false);
    });

    it('RED: refuses and runs nothing when the checkout is not the deployed commit', async () => {
        // Arrange
        const calls: { argv: readonly string[] }[] = [];

        // Act
        const result = await executeCutoverVerify(
            baseInput({ calls, readCheckoutSha: async () => '1111111111aaaa' })
        );

        // Assert
        expect(result.ok).toBe(false);
        expect(calls).toHaveLength(0);
    });

    it('lets --allow-sha-mismatch through with a warning', async () => {
        // Arrange
        const calls: { argv: readonly string[] }[] = [];
        const warnings: string[] = [];

        // Act
        const result = await executeCutoverVerify(
            baseInput({
                calls,
                readCheckoutSha: async () => '1111111111aaaa',
                options: { journal: true, catalog: false, allowShaMismatch: true },
                log: { info() {}, warn: (m) => warnings.push(m) }
            })
        );

        // Assert
        expect(result.ok).toBe(true);
        expect(warnings).toHaveLength(1);
        expect(calls).toHaveLength(1);
    });
});
