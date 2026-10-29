/**
 * Unit tests for the HOS-1957 G7 cutover wrappers: `hops cutover-step-3b`,
 * `hops cutover-step-4c` and `hops cutover-step-5b`.
 *
 * Same style as `cutover-step-3.test.ts`: pure functions plus an injected fake
 * `Runner`, so no Docker, no database, no Cloudflare and no `pnpm` process is
 * touched. Refusals come first: they are the reason these wrappers exist.
 */

import { describe, expect, it } from 'bun:test';
import { CUTOVER_STEP_3B_ARGV } from '../src/commands/cutover-step-3b.ts';
import { CUTOVER_STEP_4C_ARGV } from '../src/commands/cutover-step-4c.ts';
import { CUTOVER_STEP_5B_ARGV } from '../src/commands/cutover-step-5b.ts';
import { validateCommandFlags } from '../src/lib/cli-flags.ts';
import {
    cutoverWrapperTargetRefusal,
    type ExecuteCutoverWrapperInput,
    executeCutoverWrapper,
    isWrapperPhraseValid,
    type ParseCutoverWrapperArgsInput,
    parseCutoverWrapperArgs,
    runCutoverWrapperScript,
    shouldPromptForWrapperConfirmation
} from '../src/lib/cutover-wrapper-core.ts';
import {
    CUTOVER_STEP_3B_SPEC,
    CUTOVER_STEP_4C_SPEC,
    CUTOVER_STEP_5B_SPEC,
    type CutoverWrapperSpec
} from '../src/lib/cutover-wrapper-specs.ts';
import type { Runner, RunOptions } from '../src/lib/runner.ts';

type Call = { argv: readonly string[]; options?: RunOptions };

/** Records every run() call and answers with a fixed exit code. */
function fakeRunner(exitCode: number, calls: Call[] = []): Runner {
    return {
        async run(argv, options) {
            calls.push({ argv, options });
            return { exitCode, stdout: '', stderr: '', failed: exitCode !== 0 };
        }
    };
}

/** Parse with a fixed cwd and a file system where only `/ops/*` files exist. */
function parse(spec: CutoverWrapperSpec, argv: readonly string[]) {
    const input: ParseCutoverWrapperArgsInput = {
        spec,
        argv,
        cwd: '/ops',
        fileExists: (path) => path.startsWith('/ops/')
    };
    return parseCutoverWrapperArgs(input);
}

const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
const UUID_B = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const DEPLOYED_SHA = '0e94f0e2ee';
const CONTAINER_ENV = [
    'NODE_ENV=production',
    'HOSPEDA_DATABASE_URL=postgres://internal:5432/hospeda',
    `HOSPEDA_COMMIT_SHA=${DEPLOYED_SHA}`,
    'NODE_VERSION=22'
] as const;

function execInput(
    overrides: Partial<ExecuteCutoverWrapperInput> = {}
): ExecuteCutoverWrapperInput {
    return {
        spec: CUTOVER_STEP_4C_SPEC,
        runner: fakeRunner(0),
        repoRoot: '/srv/hospeda',
        target: 'prod',
        options: { mode: 'write', allowShaMismatch: false, yes: true, forwarded: [] },
        containerEnv: CONTAINER_ENV,
        databaseUrl: 'postgresql://u:p@127.0.0.1:5432/hospeda',
        hostEnv: { PATH: '/usr/bin', SECRET_X: 'do-not-leak' },
        readCheckoutSha: async () => `${DEPLOYED_SHA}aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`,
        confirmProd: async () => {},
        log: { info: () => {}, warn: () => {} },
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

describe('refusals', () => {
    for (const spec of [CUTOVER_STEP_3B_SPEC, CUTOVER_STEP_4C_SPEC, CUTOVER_STEP_5B_SPEC]) {
        it(`${spec.name}: refuses both modes at once`, () => {
            const parsed = parse(spec, ['--dry-run', spec.writeFlag]);
            expect(parsed.ok).toBe(false);
            if (!parsed.ok) expect(parsed.reason).toContain('exactly one');
        });

        it(`${spec.name}: refuses an unknown flag and a repeated switch`, () => {
            expect(parse(spec, ['--nope'])).toMatchObject({ ok: false });
            expect(parse(spec, ['--yes', '--yes'])).toMatchObject({ ok: false });
            expect(parse(spec, ['--dry-run=1'])).toMatchObject({ ok: false });
        });
    }

    it('3b: refuses a pass-through flag without a value, or in the spaced form', () => {
        expect(parse(CUTOVER_STEP_3B_SPEC, ['--plan-id'])).toMatchObject({ ok: false });
        expect(parse(CUTOVER_STEP_3B_SPEC, ['--plan-id='])).toMatchObject({ ok: false });
    });

    it('3b: refuses a third --beneficiary and a second --plan-id', () => {
        expect(
            parse(CUTOVER_STEP_3B_SPEC, [
                `--beneficiary=${UUID_A}`,
                `--beneficiary=${UUID_B}`,
                `--beneficiary=${UUID_A}`
            ])
        ).toMatchObject({ ok: false });
        expect(
            parse(CUTOVER_STEP_3B_SPEC, [`--plan-id=${UUID_A}`, `--plan-id=${UUID_B}`])
        ).toMatchObject({ ok: false });
    });

    it('4c: refuses an extra file that does not exist', () => {
        const parsed = parse(CUTOVER_STEP_4C_SPEC, ['--extra-tags-file=/elsewhere/tags.txt']);
        expect(parsed.ok).toBe(false);
        if (!parsed.ok) expect(parsed.reason).toContain('/elsewhere/tags.txt');
    });

    it('5b: refuses --execute on staging, before any lookup', () => {
        const reason = cutoverWrapperTargetRefusal({
            spec: CUTOVER_STEP_5B_SPEC,
            target: 'staging',
            mode: 'write'
        });
        expect(reason).toContain('refused on staging');
        expect(
            cutoverWrapperTargetRefusal({
                spec: CUTOVER_STEP_5B_SPEC,
                target: 'staging',
                mode: 'dry-run'
            })
        ).toBeUndefined();
        expect(
            cutoverWrapperTargetRefusal({
                spec: CUTOVER_STEP_5B_SPEC,
                target: 'prod',
                mode: 'write'
            })
        ).toBeUndefined();
    });

    it('the target refusal runs before repo, container and database lookups', async () => {
        const source = await Bun.file(
            `${import.meta.dir}/../src/lib/cutover-wrapper-command.ts`
        ).text();
        const guard = source.indexOf('cutoverWrapperTargetRefusal({');
        expect(guard).toBeGreaterThan(-1);
        expect(guard).toBeLessThan(source.indexOf('resolveRepoRoot()'));
        expect(guard).toBeLessThan(source.indexOf("findContainer('api')"));
        expect(guard).toBeLessThan(source.indexOf('buildPostgresUrl({'));
    });

    it('never runs the script when the prod confirmation throws', async () => {
        const calls: Call[] = [];
        const result = await executeCutoverWrapper(
            execInput({
                runner: fakeRunner(0, calls),
                confirmProd: async () => {
                    throw new Error('rejected');
                }
            })
        );
        expect(calls.length).toBe(0);
        expect(result).toMatchObject({ ok: false, reason: 'confirmation-rejected' });
    });

    it('stops before confirmation and the runner when the SHA guard rejects', async () => {
        const calls: Call[] = [];
        let confirmations = 0;
        const result = await executeCutoverWrapper(
            execInput({
                runner: fakeRunner(0, calls),
                readCheckoutSha: async () => 'ffffffffffffffffffffffffffffffffffffffff',
                confirmProd: async () => {
                    confirmations += 1;
                }
            })
        );
        expect(calls.length).toBe(0);
        expect(confirmations).toBe(0);
        expect(result).toMatchObject({ ok: false, reason: 'sha-guard' });
    });

    it('accepts only the exact phrase of each wrapper', () => {
        expect(
            isWrapperPhraseValid({ spec: CUTOVER_STEP_3B_SPEC, typed: 'grant-permanent-prod' })
        ).toBe(true);
        expect(isWrapperPhraseValid({ spec: CUTOVER_STEP_4C_SPEC, typed: 'purge-prod' })).toBe(
            true
        );
        expect(
            isWrapperPhraseValid({ spec: CUTOVER_STEP_5B_SPEC, typed: 'delete-remote-prod' })
        ).toBe(true);
        expect(isWrapperPhraseValid({ spec: CUTOVER_STEP_5B_SPEC, typed: 'purge-prod' })).toBe(
            false
        );
        expect(isWrapperPhraseValid({ spec: CUTOVER_STEP_4C_SPEC, typed: 'purge-prod ' })).toBe(
            false
        );
        expect(
            isWrapperPhraseValid({ spec: CUTOVER_STEP_4C_SPEC, typed: 'write-trials-prod' })
        ).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Typed prod confirmation, independent of --yes
// ---------------------------------------------------------------------------

describe('typed prod confirmation', () => {
    it('asks on a prod write even with --yes, and never on staging', () => {
        const base = { mode: 'write', allowShaMismatch: false, yes: true } as const;
        expect(shouldPromptForWrapperConfirmation({ ...base, target: 'prod' })).toBe(true);
        expect(shouldPromptForWrapperConfirmation({ ...base, target: 'staging' })).toBe(false);
    });

    it('asks on a prod dry-run only when the SHA guard is overridden', () => {
        const base = { target: 'prod', mode: 'dry-run', yes: true } as const;
        expect(shouldPromptForWrapperConfirmation({ ...base, allowShaMismatch: false })).toBe(
            false
        );
        expect(shouldPromptForWrapperConfirmation({ ...base, allowShaMismatch: true })).toBe(true);
    });

    it('confirms a prod write exactly once before running, with the spec in hand', async () => {
        const events: string[] = [];
        const runner: Runner = {
            async run() {
                events.push('run');
                return { exitCode: 0, stdout: '', stderr: '', failed: false };
            }
        };
        const result = await executeCutoverWrapper(
            execInput({
                spec: CUTOVER_STEP_3B_SPEC,
                runner,
                confirmProd: async ({ spec }) => {
                    events.push(`confirm:${spec.prodPhrase}`);
                }
            })
        );
        expect(events).toEqual(['confirm:grant-permanent-prod', 'run']);
        expect(result).toEqual({ ok: true, exitCode: 0 });
    });
});

// ---------------------------------------------------------------------------
// 5b: list-only is the default
// ---------------------------------------------------------------------------

describe('5b list-only default', () => {
    it('defaults to list-only, and --list-only is the same mode', () => {
        expect(parse(CUTOVER_STEP_5B_SPEC, [])).toMatchObject({
            ok: true,
            value: { mode: 'dry-run' }
        });
        expect(parse(CUTOVER_STEP_5B_SPEC, ['--list-only'])).toMatchObject({
            ok: true,
            value: { mode: 'dry-run' }
        });
        expect(parse(CUTOVER_STEP_5B_SPEC, ['--execute'])).toMatchObject({
            ok: true,
            value: { mode: 'write' }
        });
        expect(parse(CUTOVER_STEP_5B_SPEC, ['--list-only', '--execute'])).toMatchObject({
            ok: false
        });
    });

    it('does not accept the script-level --confirm-delete-remote directly', () => {
        expect(parse(CUTOVER_STEP_5B_SPEC, ['--confirm-delete-remote'])).toMatchObject({
            ok: false
        });
    });

    it('sends --dry-run to the script by default and --confirm-delete-remote only on --execute', async () => {
        const calls: Call[] = [];
        const runner = fakeRunner(0, calls);
        const common = {
            runner,
            repoRoot: '/srv/hospeda',
            spec: CUTOVER_STEP_5B_SPEC,
            env: {},
            forwarded: []
        };
        await runCutoverWrapperScript({ ...common, mode: 'dry-run' });
        await runCutoverWrapperScript({ ...common, mode: 'write' });
        expect(calls[0]?.argv.slice(5)).toEqual(['scripts/cutover-v6-step-5b.ts', '--dry-run']);
        expect(calls[1]?.argv.slice(5)).toEqual([
            'scripts/cutover-v6-step-5b.ts',
            '--confirm-delete-remote'
        ]);
    });
});

// ---------------------------------------------------------------------------
// Child invocation, forwarding and exit codes
// ---------------------------------------------------------------------------

describe('child invocation', () => {
    it('3b: forwards every pass-through flag in order, after the mode flag', async () => {
        const argv = [
            `--actor-user-id=${UUID_A}`,
            `--beneficiary=${UUID_A}`,
            `--beneficiary=${UUID_B}`,
            `--plan-id=${UUID_B}`,
            `--floor-plan-version-id=${UUID_A}`,
            '--includes-addons=false'
        ];
        const parsed = parse(CUTOVER_STEP_3B_SPEC, ['--confirm', ...argv]);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.value.mode).toBe('write');
        const calls: Call[] = [];
        await runCutoverWrapperScript({
            runner: fakeRunner(0, calls),
            repoRoot: '/srv/hospeda',
            spec: CUTOVER_STEP_3B_SPEC,
            mode: parsed.value.mode,
            forwarded: parsed.value.forwarded,
            env: { NODE_ENV: 'production' }
        });
        expect(calls[0]?.argv).toEqual([
            'pnpm',
            '--dir',
            'apps/api',
            'exec',
            'tsx',
            'scripts/cutover-b9a-step-3b.ts',
            '--confirm',
            ...argv
        ]);
        expect(calls[0]?.options).toEqual({
            cwd: '/srv/hospeda',
            inherit: true,
            inheritEnv: false,
            env: { NODE_ENV: 'production' }
        });
    });

    it('4c: forwards the extra files as absolute paths resolved against the cwd', () => {
        const parsed = parse(CUTOVER_STEP_4C_SPEC, [
            '--extra-tags-file=tags.txt',
            '--extra-prefixes-file=/ops/prefixes.txt'
        ]);
        expect(parsed).toMatchObject({
            ok: true,
            value: {
                mode: 'dry-run',
                forwarded: [
                    '--extra-tags-file=/ops/tags.txt',
                    '--extra-prefixes-file=/ops/prefixes.txt'
                ]
            }
        });
    });

    for (const exitCode of [0, 1, 2]) {
        it(`propagates the script exit code ${exitCode} unchanged`, async () => {
            const result = await executeCutoverWrapper(execInput({ runner: fakeRunner(exitCode) }));
            expect(result).toEqual({ ok: true, exitCode });
        });
    }

    it('runs the child with only the allowlisted env', async () => {
        const calls: Call[] = [];
        await executeCutoverWrapper(execInput({ runner: fakeRunner(0, calls) }));
        const env = calls[0]?.options?.env ?? {};
        expect(calls[0]?.options?.inheritEnv).toBe(false);
        expect(env.HOSPEDA_DATABASE_URL).toBe('postgresql://u:p@127.0.0.1:5432/hospeda');
        expect(env.SECRET_X).toBeUndefined();
        expect(env.NODE_VERSION).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Registry entries
// ---------------------------------------------------------------------------

describe('registered argv specs', () => {
    const cases = [
        {
            name: 'cutover-step-3b',
            spec: CUTOVER_STEP_3B_ARGV,
            run: 'cutoverStep3b',
            sample: [`--plan-id=${UUID_A}`, '--confirm']
        },
        {
            name: 'cutover-step-4c',
            spec: CUTOVER_STEP_4C_ARGV,
            run: 'cutoverStep4c',
            sample: ['--extra-tags-file=x', '--confirm-purge']
        },
        {
            name: 'cutover-step-5b',
            spec: CUTOVER_STEP_5B_ARGV,
            run: 'cutoverStep5b',
            sample: ['--list-only', '--execute']
        }
    ] as const;

    for (const entry of cases) {
        it(`${entry.name}: accepts its declared flags and rejects others`, () => {
            const base = ['--dry-run', '--allow-sha-mismatch', '--yes', '--help', '-h'];
            expect(
                validateCommandFlags({ argv: [...base, ...entry.sample], spec: entry.spec }).unknown
            ).toEqual([]);
            expect(
                validateCommandFlags({ argv: ['--reset'], spec: entry.spec }).unknown.map(
                    (u) => u.flag
                )
            ).toEqual(['--reset']);
        });

        it(`${entry.name}: is registered as explicit-required`, async () => {
            const source = await Bun.file(`${import.meta.dir}/../src/index.ts`).text();
            const start = source.indexOf(`name: '${entry.name}'`);
            expect(start).toBeGreaterThan(-1);
            const block = source.slice(start, source.indexOf(`run: ${entry.run}`, start));
            expect(block).toContain("targetPolicy: 'explicit-required'");
        });
    }
});
