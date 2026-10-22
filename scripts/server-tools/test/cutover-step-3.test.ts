/**
 * Unit tests for `hops cutover-step-3` — the V6 cutover step 3 wrapper.
 *
 * Everything here runs against pure functions plus an injected fake `Runner`,
 * so no Docker, no database and no `pnpm` process is touched. The command's
 * I/O (container inspection, URL building, prompt) is wired in
 * `src/commands/cutover-step-3.ts` and exercised by hand on the VPS.
 */

import { describe, expect, it } from 'bun:test';
import { CUTOVER_STEP_3_ARGV } from '../src/commands/cutover-step-3.ts';
import { validateCommandFlags } from '../src/lib/cli-flags.ts';
import {
    buildStep3ChildEnv,
    checkDeployedSha,
    isTypedConfirmationValid,
    parseCutoverStep3Args,
    requiresTypedConfirmation,
    runCutoverStep3
} from '../src/lib/cutover-step-3-core.ts';
import type { Runner, RunOptions } from '../src/lib/runner.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Records every run() call and answers with a fixed exit code. */
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

const CONTAINER_ENV = [
    'PATH=/usr/bin',
    'HOME=/root',
    'NODE_ENV=production',
    'HOSPEDA_DATABASE_URL=postgres://internal:5432/hospeda',
    'HOSPEDA_BETTER_AUTH_SECRET=s',
    'NODE_VERSION=22',
    'FOO=bar',
    'HOSPEDA_X=a=b'
] as const;

// ---------------------------------------------------------------------------
// TEST:1745:1 — parseCutoverStep3Args
// ---------------------------------------------------------------------------

describe('parseCutoverStep3Args', () => {
    it('defaults to dry-run with no flags', () => {
        const parsed = parseCutoverStep3Args([]);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) expect(parsed.value.mode).toBe('dry-run');
    });

    it('honours --dry-run explicitly', () => {
        const parsed = parseCutoverStep3Args(['--dry-run']);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) expect(parsed.value.mode).toBe('dry-run');
    });

    it('switches to write mode only with --confirm-write-trials', () => {
        const parsed = parseCutoverStep3Args(['--confirm-write-trials']);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) expect(parsed.value.mode).toBe('write');
    });

    it('refuses both modes at once', () => {
        const parsed = parseCutoverStep3Args(['--dry-run', '--confirm-write-trials']);
        expect(parsed.ok).toBe(false);
        if (!parsed.ok) expect(parsed.reason).toContain('exactly one');
    });

    it('refuses an unknown flag', () => {
        const parsed = parseCutoverStep3Args(['--nope']);
        expect(parsed.ok).toBe(false);
        if (!parsed.ok) expect(parsed.reason).toContain('--nope');
    });

    it('parses --allow-sha-mismatch and --yes', () => {
        const parsed = parseCutoverStep3Args(['--allow-sha-mismatch', '--yes']);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.value.allowShaMismatch).toBe(true);
            expect(parsed.value.yes).toBe(true);
            expect(parsed.value.mode).toBe('dry-run');
        }
    });
});

// ---------------------------------------------------------------------------
// TEST:1745:2 — typed confirmation policy
// ---------------------------------------------------------------------------

describe('requiresTypedConfirmation', () => {
    it('requires it for a prod write', () => {
        expect(
            requiresTypedConfirmation({ target: 'prod', mode: 'write', allowShaMismatch: false })
        ).toBe(true);
    });

    it('does not require it for a prod dry-run', () => {
        expect(
            requiresTypedConfirmation({ target: 'prod', mode: 'dry-run', allowShaMismatch: false })
        ).toBe(false);
    });

    it('requires it for a prod dry-run that overrides the SHA guard', () => {
        expect(
            requiresTypedConfirmation({ target: 'prod', mode: 'dry-run', allowShaMismatch: true })
        ).toBe(true);
    });

    it('never requires it on staging', () => {
        expect(
            requiresTypedConfirmation({ target: 'staging', mode: 'write', allowShaMismatch: false })
        ).toBe(false);
    });
});

describe('isTypedConfirmationValid', () => {
    it('accepts only the exact phrase', () => {
        expect(isTypedConfirmationValid({ typed: 'write-trials-prod' })).toBe(true);
        expect(isTypedConfirmationValid({ typed: 'write-trials-prod ' })).toBe(false);
        expect(isTypedConfirmationValid({ typed: 'WRITE-TRIALS-PROD' })).toBe(false);
        expect(isTypedConfirmationValid({ typed: 'yes' })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// TEST:1745:3 — exit-code propagation and the exact child invocation
// ---------------------------------------------------------------------------

describe('runCutoverStep3', () => {
    const env = { NODE_ENV: 'production', HOSPEDA_DATABASE_URL: 'postgresql://host/db' };

    it('propagates exit code 0', async () => {
        const code = await runCutoverStep3({
            runner: fakeRunner(0, []),
            repoRoot: '/srv/hospeda',
            mode: 'dry-run',
            env
        });
        expect(code).toBe(0);
    });

    it('propagates exit code 1', async () => {
        const code = await runCutoverStep3({
            runner: fakeRunner(1, []),
            repoRoot: '/srv/hospeda',
            mode: 'write',
            env
        });
        expect(code).toBe(1);
    });

    it('propagates exit code 2', async () => {
        const code = await runCutoverStep3({
            runner: fakeRunner(2, []),
            repoRoot: '/srv/hospeda',
            mode: 'dry-run',
            env
        });
        expect(code).toBe(2);
    });

    it('runs the script exactly as documented, inheriting stdio', async () => {
        const calls: { argv: readonly string[]; options?: RunOptions }[] = [];
        await runCutoverStep3({
            runner: fakeRunner(0, calls),
            repoRoot: '/srv/hospeda',
            mode: 'dry-run',
            env
        });
        expect(calls[0]?.argv).toEqual([
            'pnpm',
            '--filter',
            'hospeda-api',
            'exec',
            'tsx',
            'scripts/cutover-v6-step-3.ts',
            '--dry-run'
        ]);
        expect(calls[0]?.options).toEqual({
            cwd: '/srv/hospeda',
            inherit: true,
            env
        });
    });

    it('passes --confirm-write-trials in write mode', async () => {
        const calls: { argv: readonly string[]; options?: RunOptions }[] = [];
        await runCutoverStep3({
            runner: fakeRunner(0, calls),
            repoRoot: '/srv/hospeda',
            mode: 'write',
            env
        });
        expect(calls[0]?.argv.at(-1)).toBe('--confirm-write-trials');
    });
});

// ---------------------------------------------------------------------------
// TEST:1745:4 — child env: only HOSPEDA_* + NODE_ENV, host DB URL wins
// ---------------------------------------------------------------------------

describe('buildStep3ChildEnv', () => {
    it('keeps only HOSPEDA_* and NODE_ENV and replaces the DB URL', () => {
        const env = buildStep3ChildEnv({
            containerEnv: CONTAINER_ENV,
            databaseUrl: 'postgresql://hospeda_user:pass@127.0.0.1:5432/hospeda_staging'
        });
        expect(env).toEqual({
            NODE_ENV: 'production',
            HOSPEDA_DATABASE_URL: 'postgresql://hospeda_user:pass@127.0.0.1:5432/hospeda_staging',
            HOSPEDA_BETTER_AUTH_SECRET: 's',
            HOSPEDA_X: 'a=b'
        });
        expect(env.PATH).toBeUndefined();
        expect(env.HOME).toBeUndefined();
        expect(env.NODE_VERSION).toBeUndefined();
        expect(env.FOO).toBeUndefined();
    });

    it('preserves "=" characters inside a value', () => {
        const env = buildStep3ChildEnv({
            containerEnv: ['HOSPEDA_X=a=b'],
            databaseUrl: 'postgresql://host/db'
        });
        expect(env.HOSPEDA_X).toBe('a=b');
    });
});

// ---------------------------------------------------------------------------
// TEST:1745:5 — deployed SHA guard
// ---------------------------------------------------------------------------

describe('checkDeployedSha', () => {
    const checkout = '0e94f0e2eeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const deployed = '0e94f0e2ee';

    it('passes when the deployed SHA is a 10-char prefix of HEAD', () => {
        expect(
            checkDeployedSha({ checkoutSha: checkout, deployedSha: deployed, allowMismatch: false })
        ).toEqual({ ok: true });
    });

    it('fails on a mismatch, naming both SHAs', () => {
        const result = checkDeployedSha({
            checkoutSha: checkout,
            deployedSha: 'ffffffffff',
            allowMismatch: false
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toContain(checkout);
            expect(result.message).toContain('ffffffffff');
        }
    });

    it('passes a mismatch with a warning when --allow-sha-mismatch is set', () => {
        const result = checkDeployedSha({
            checkoutSha: checkout,
            deployedSha: 'ffffffffff',
            allowMismatch: true
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.warning).toContain(checkout);
            expect(result.warning).toContain('ffffffffff');
        }
    });

    it('fails when the deployed SHA is missing or unknown', () => {
        expect(
            checkDeployedSha({
                checkoutSha: checkout,
                deployedSha: undefined,
                allowMismatch: false
            }).ok
        ).toBe(false);
        expect(
            checkDeployedSha({
                checkoutSha: checkout,
                deployedSha: 'unknown',
                allowMismatch: false
            }).ok
        ).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// TEST:1745:6 — the registry entry
// ---------------------------------------------------------------------------

describe('the registered cutover-step-3 argv spec', () => {
    it('accepts every declared flag', () => {
        const unknown = validateCommandFlags({
            argv: [
                '--dry-run',
                '--confirm-write-trials',
                '--allow-sha-mismatch',
                '--yes',
                '--help',
                '-h'
            ],
            spec: CUTOVER_STEP_3_ARGV
        }).unknown;
        expect(unknown).toEqual([]);
    });

    it('rejects an undeclared flag', () => {
        const unknown = validateCommandFlags({
            argv: ['--reset'],
            spec: CUTOVER_STEP_3_ARGV
        }).unknown;
        expect(unknown.map((entry) => entry.flag)).toEqual(['--reset']);
    });

    it('is wired into the command registry as explicit-required', async () => {
        const source = await Bun.file(`${import.meta.dir}/../src/index.ts`).text();
        const start = source.indexOf("name: 'cutover-step-3'");
        expect(start).toBeGreaterThan(-1);
        const entry = source.slice(start, source.indexOf('run: cutoverStep3', start));
        expect(entry).toContain("targetPolicy: 'explicit-required'");
        expect(entry).toContain('CUTOVER_STEP_3_ARGV');
    });
});
