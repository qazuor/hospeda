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
    type CutoverStep3Mode,
    checkDeployedSha,
    type ExecuteCutoverStep3Input,
    executeCutoverStep3,
    isTypedConfirmationValid,
    ownerIdsTargetRefusal,
    parseCutoverStep3Args,
    requiresTypedConfirmation,
    runCutoverStep3,
    shouldPromptForTypedConfirmation
} from '../src/lib/cutover-step-3-core.ts';
import type { Runner, RunOptions } from '../src/lib/runner.ts';
import type { Target } from '../src/lib/target.ts';

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

/**
 * Simulated host environment. The allowlist keys let `pnpm`/`node` start; the
 * rest must never reach the child. `HOSPEDA_*` values are decoys: the
 * container's value always wins and a host-only `HOSPEDA_*` never enters.
 */
const HOST_ENV = {
    PATH: '/usr/local/bin:/usr/bin',
    HOME: '/root',
    LANG: 'C.UTF-8',
    SECRET_X: 'do-not-leak',
    NODE_OPTIONS: '--max-old-space-size=512',
    HOSPEDA_DATABASE_URL: 'postgresql://host-leak/db',
    HOSPEDA_BETTER_AUTH_SECRET: 'host-secret',
    HOSPEDA_HOST_ONLY: 'do-not-leak',
    FOO: 'bar'
} as const;

const DATABASE_URL = 'postgresql://hospeda_user:pass@127.0.0.1:5432/hospeda_staging';

/** The only keys allowed in the child env: container filter + host allowlist + DB URL. */
const EXPECTED_CHILD_ENV_KEYS = [
    'HOME',
    'HOSPEDA_BETTER_AUTH_SECRET',
    'HOSPEDA_DATABASE_URL',
    'HOSPEDA_X',
    'LANG',
    'NODE_ENV',
    'PATH'
];

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

    it('preserves owner ids, refuses repeated flags, and permits the central equals syntax', () => {
        expect(parseCutoverStep3Args(['--dry-run', '--owner-ids=one,two'])).toMatchObject({
            ok: true,
            value: { ownerIds: 'one,two' }
        });
        expect(parseCutoverStep3Args(['--dry-run', '--dry-run'])).toMatchObject({ ok: false });
        expect(
            parseCutoverStep3Args(['--dry-run', '--owner-ids=one', '--owner-ids=two'])
        ).toMatchObject({ ok: false });
    });
});

describe('ownerIdsTargetRefusal', () => {
    it('rejects owner filtering on prod before resource lookups and ignores unrelated override flags', () => {
        const parsed = parseCutoverStep3Args(['--yes', '--allow-sha-mismatch', '--owner-ids=x']);
        expect(parsed.ok).toBe(true);
        if (parsed.ok)
            expect(ownerIdsTargetRefusal('prod', parsed.value.ownerIds)).toContain(
                'only allowed for staging'
            );
        expect(ownerIdsTargetRefusal('staging', 'x')).toBeUndefined();
        expect(ownerIdsTargetRefusal('prod', undefined)).toBeUndefined();
    });

    it('is enforced before repository and container/database lookups in the command wrapper', async () => {
        const source = await Bun.file(
            `${import.meta.dir}/../src/commands/cutover-step-3.ts`
        ).text();
        const guard = source.indexOf('ownerIdsTargetRefusal(target, options.ownerIds)');
        expect(guard).toBeGreaterThan(-1);
        expect(guard).toBeLessThan(source.indexOf('resolveRepoRoot()'));
        expect(guard).toBeLessThan(source.indexOf("findContainer('api')"));
        expect(guard).toBeLessThan(source.indexOf('dockerInspectEnv(apiContainer)'));
        expect(guard).toBeLessThan(source.indexOf('buildPostgresUrl({'));
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

describe('shouldPromptForTypedConfirmation', () => {
    it('asks on a prod write even when --yes is set', () => {
        expect(
            shouldPromptForTypedConfirmation({
                target: 'prod',
                mode: 'write',
                allowShaMismatch: false,
                yes: true
            })
        ).toBe(true);
    });

    it('asks on a prod dry-run with --allow-sha-mismatch even when --yes is set', () => {
        expect(
            shouldPromptForTypedConfirmation({
                target: 'prod',
                mode: 'dry-run',
                allowShaMismatch: true,
                yes: true
            })
        ).toBe(true);
    });

    it('does not ask on a plain prod dry-run, with or without --yes', () => {
        expect(
            shouldPromptForTypedConfirmation({
                target: 'prod',
                mode: 'dry-run',
                allowShaMismatch: false,
                yes: false
            })
        ).toBe(false);
        expect(
            shouldPromptForTypedConfirmation({
                target: 'prod',
                mode: 'dry-run',
                allowShaMismatch: false,
                yes: true
            })
        ).toBe(false);
    });

    it('never asks on staging, with or without --yes', () => {
        expect(
            shouldPromptForTypedConfirmation({
                target: 'staging',
                mode: 'write',
                allowShaMismatch: true,
                yes: true
            })
        ).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// TEST:1745:2 — executeCutoverStep3: the orchestration around the decision
//
// These tests exercise the call site, not the pure decision: they would fail
// if the command started skipping the prompt because of `--yes`, before the
// version guard or around any other input.
// ---------------------------------------------------------------------------

const CHECKOUT_SHA = '0e94f0e2eeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const DEPLOYED_SHA = '0e94f0e2ee';
const PROD_CONTAINER_ENV = [...CONTAINER_ENV, `HOSPEDA_COMMIT_SHA=${DEPLOYED_SHA}`];

/** An execution input whose defaults pass every guard (prod write, `--yes`). */
function execInput(overrides: Partial<ExecuteCutoverStep3Input> = {}): ExecuteCutoverStep3Input {
    return {
        runner: fakeRunner(0, []),
        repoRoot: '/srv/hospeda',
        target: 'prod',
        options: { mode: 'write', allowShaMismatch: false, yes: true },
        containerEnv: PROD_CONTAINER_ENV,
        databaseUrl: DATABASE_URL,
        hostEnv: HOST_ENV,
        readCheckoutSha: async () => CHECKOUT_SHA,
        confirmProd: async () => {},
        log: { info: () => {}, warn: () => {} },
        ...overrides
    };
}

describe('executeCutoverStep3', () => {
    it('confirms a prod write exactly once before running, even with --yes', async () => {
        const events: string[] = [];
        const runner: Runner = {
            async run() {
                events.push('run');
                return { exitCode: 0, stdout: '', stderr: '', failed: false };
            }
        };

        const result = await executeCutoverStep3(
            execInput({
                runner,
                confirmProd: async () => {
                    events.push('confirm');
                }
            })
        );

        expect(events).toEqual(['confirm', 'run']);
        expect(result).toEqual({ ok: true, exitCode: 0 });
    });

    it('never runs the script when the prod confirmation throws', async () => {
        let runs = 0;
        const runner: Runner = {
            async run() {
                runs += 1;
                return { exitCode: 0, stdout: '', stderr: '', failed: false };
            }
        };

        const result = await executeCutoverStep3(
            execInput({
                runner,
                confirmProd: async () => {
                    throw new Error('rejected');
                }
            })
        );

        expect(runs).toBe(0);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('confirmation-rejected');
    });

    it('confirms a prod dry-run that overrides the SHA guard, even with --yes', async () => {
        const confirmations: { target: Target; mode: CutoverStep3Mode }[] = [];

        const result = await executeCutoverStep3(
            execInput({
                options: { mode: 'dry-run', allowShaMismatch: true, yes: true },
                confirmProd: async (input) => {
                    confirmations.push({ target: input.target, mode: input.mode });
                }
            })
        );

        expect(confirmations).toEqual([{ target: 'prod', mode: 'dry-run' }]);
        expect(result.ok).toBe(true);
    });

    it('does not confirm on staging, even with --yes', async () => {
        let confirmations = 0;

        const result = await executeCutoverStep3(
            execInput({
                target: 'staging',
                confirmProd: async () => {
                    confirmations += 1;
                }
            })
        );

        expect(confirmations).toBe(0);
        expect(result.ok).toBe(true);
    });

    it('stops before confirmation and the runner when the SHA guard rejects the checkout', async () => {
        let runs = 0;
        let confirmations = 0;
        const runner: Runner = {
            async run() {
                runs += 1;
                return { exitCode: 0, stdout: '', stderr: '', failed: false };
            }
        };

        const result = await executeCutoverStep3(
            execInput({
                runner,
                readCheckoutSha: async () => 'ffffffffffffffffffffffffffffffffffffffff',
                confirmProd: async () => {
                    confirmations += 1;
                }
            })
        );

        expect(runs).toBe(0);
        expect(confirmations).toBe(0);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('sha-guard');
            expect(result.message).toContain('ffffffffffffffffffffffffffffffffffffffff');
            expect(result.message).toContain(DEPLOYED_SHA);
        }
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
            inheritEnv: false,
            env
        });
    });

    it('forwards owner ids unchanged after the mode flag', async () => {
        const calls: { argv: readonly string[]; options?: RunOptions }[] = [];
        await runCutoverStep3({
            runner: fakeRunner(0, calls),
            repoRoot: '/srv/hospeda',
            mode: 'dry-run',
            env,
            ownerIds: '550e8400-e29b-41d4-a716-446655440000,6ba7b810-9dad-41d1-80b4-00c04fd430c8'
        });
        expect(calls[0]?.argv).toEqual([
            'pnpm',
            '--filter',
            'hospeda-api',
            'exec',
            'tsx',
            'scripts/cutover-v6-step-3.ts',
            '--dry-run',
            '--owner-ids=550e8400-e29b-41d4-a716-446655440000,6ba7b810-9dad-41d1-80b4-00c04fd430c8'
        ]);
    });

    it('runs the child with inheritEnv:false and only the allowlisted env', async () => {
        const calls: { argv: readonly string[]; options?: RunOptions }[] = [];
        const childEnv = buildStep3ChildEnv({
            containerEnv: CONTAINER_ENV,
            databaseUrl: DATABASE_URL,
            hostEnv: HOST_ENV
        });

        await runCutoverStep3({
            runner: fakeRunner(0, calls),
            repoRoot: '/srv/hospeda',
            mode: 'write',
            env: childEnv
        });

        const options = calls[0]?.options;
        expect(options?.inheritEnv).toBe(false);
        expect(Object.keys(options?.env ?? {}).sort()).toEqual(EXPECTED_CHILD_ENV_KEYS);
        expect(options?.env).toEqual({
            NODE_ENV: 'production',
            HOSPEDA_DATABASE_URL: DATABASE_URL,
            HOSPEDA_BETTER_AUTH_SECRET: 's',
            HOSPEDA_X: 'a=b',
            PATH: HOST_ENV.PATH,
            HOME: HOST_ENV.HOME,
            LANG: HOST_ENV.LANG
        });
        expect(options?.env?.SECRET_X).toBeUndefined();
        expect(options?.env?.NODE_OPTIONS).toBeUndefined();
        expect(options?.env?.FOO).toBeUndefined();
        expect(options?.env?.HOSPEDA_HOST_ONLY).toBeUndefined();
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
    it('keeps only HOSPEDA_* and NODE_ENV from the container, plus the host allowlist', () => {
        const env = buildStep3ChildEnv({
            containerEnv: CONTAINER_ENV,
            databaseUrl: DATABASE_URL,
            hostEnv: HOST_ENV
        });
        expect(env).toEqual({
            NODE_ENV: 'production',
            HOSPEDA_DATABASE_URL: DATABASE_URL,
            HOSPEDA_BETTER_AUTH_SECRET: 's',
            HOSPEDA_X: 'a=b',
            PATH: HOST_ENV.PATH,
            HOME: HOST_ENV.HOME,
            LANG: HOST_ENV.LANG
        });
        expect(Object.keys(env).sort()).toEqual(EXPECTED_CHILD_ENV_KEYS);
        expect(env.NODE_VERSION).toBeUndefined();
        expect(env.FOO).toBeUndefined();
        expect(env.SECRET_X).toBeUndefined();
        expect(env.NODE_OPTIONS).toBeUndefined();
        expect(env.HOSPEDA_HOST_ONLY).toBeUndefined();
    });

    it('never lets a host HOSPEDA_* win over the container value', () => {
        const env = buildStep3ChildEnv({
            containerEnv: CONTAINER_ENV,
            databaseUrl: DATABASE_URL,
            hostEnv: HOST_ENV
        });
        expect(env.HOSPEDA_BETTER_AUTH_SECRET).toBe('s');
        expect(env.HOSPEDA_DATABASE_URL).toBe(DATABASE_URL);
    });

    it('omits allowlisted host keys that are absent', () => {
        const env = buildStep3ChildEnv({
            containerEnv: ['NODE_ENV=production'],
            databaseUrl: DATABASE_URL,
            hostEnv: {}
        });
        expect(env).toEqual({
            NODE_ENV: 'production',
            HOSPEDA_DATABASE_URL: DATABASE_URL
        });
    });

    it('preserves "=" characters inside a value', () => {
        const env = buildStep3ChildEnv({
            containerEnv: ['HOSPEDA_X=a=b'],
            databaseUrl: 'postgresql://host/db',
            hostEnv: {}
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
                '--owner-ids=550e8400-e29b-41d4-a716-446655440000',
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
