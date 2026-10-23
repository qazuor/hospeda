/**
 * Unit tests for the cutover-step-3 child environment and the deployed-SHA
 * fallback.
 *
 * The new allowlist must forward the api container's `API_*`, `PORT` and
 * `HOSPEDA_*` entries while keeping the container's system variables out, and
 * the version guard must fall back to `SOURCE_COMMIT` when
 * `HOSPEDA_COMMIT_SHA` is empty or `unknown`. Everything runs against pure
 * functions plus an injected fake `Runner`: no Docker, no database and no
 * `pnpm` process is touched. Values are deliberately fake — never a secret.
 */

import { describe, expect, it } from 'bun:test';
import {
    buildStep3ChildEnv,
    checkDeployedSha,
    type ExecuteCutoverStep3Input,
    executeCutoverStep3
} from '../src/lib/cutover-step-3-core.ts';
import { resolveDeployedSha } from '../src/lib/cutover-step-3-env.ts';
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

/**
 * The 18 `API_*` keys the api schema declares, copied by name from
 * `apps/api/src/utils/env-schema.ts`. This package is not part of the pnpm
 * workspace, so the real schema cannot be imported here: the fixture uses the
 * real NAMES with obviously fake values.
 */
const REAL_API_KEYS = [
    'API_PORT',
    'API_HOST',
    'API_LOG_LEVEL',
    'API_LOG_FORMAT',
    'API_LOG_SAVE',
    'API_CORS_ORIGINS',
    'API_CORS_ALLOW_CREDENTIALS',
    'API_CORS_MAX_AGE',
    'API_CACHE_ENABLED',
    'API_COMPRESSION_ENABLED',
    'API_RATE_LIMIT_ENABLED',
    'API_RATE_LIMIT_WINDOW_MS',
    'API_RATE_LIMIT_MAX_REQUESTS',
    'API_RATE_LIMIT_TRUST_PROXY',
    'API_RATE_LIMIT_AUTH_ENABLED',
    'API_SECURITY_ENABLED',
    'API_VALIDATION_MAX_BODY_SIZE',
    'API_METRICS_ENABLED'
] as const;

const CHECKOUT_SHA = '0e94f0e2eeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const DEPLOYED_SHA = '0e94f0e2ee';
const DATABASE_URL = 'postgresql://host-fake/db';

/**
 * The container env shape the smoke found on staging and prod: the 18 `API_*`
 * keys, `PORT`, the `HOSPEDA_*` surface (with an EMPTY `HOSPEDA_COMMIT_SHA`),
 * Coolify's `SOURCE_COMMIT`, the image's system entries and near-miss names
 * that must never pass.
 */
const REAL_CONTAINER_ENV: ReadonlyArray<string> = [
    ...REAL_API_KEYS.map((key) =>
        key === 'API_CORS_ORIGINS' ? `${key}=https://fake.example.invalid` : `${key}=fake-value`
    ),
    'PORT=3001',
    'NODE_ENV=production',
    'HOSPEDA_DATABASE_URL=postgresql://internal-fake/db',
    'HOSPEDA_BETTER_AUTH_SECRET=fake-secret',
    'HOSPEDA_COMMIT_SHA=',
    'HOSPEDA_SENTRY_RELEASE=fake-release',
    'SOURCE_COMMIT=0e94f0e2eeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'PATH=/usr/local/bin:/usr/bin',
    'HOME=/root',
    'NODE_VERSION=22.19.0',
    'HOSTNAME=fake-container',
    'APIX_FOO=fake-value',
    'MY_API_KEY=fake-value',
    'PORTAL=fake-value',
    'PORT_X=fake-value',
    'API=fake-value'
];

/** Host env: the allowlist, plus decoys that must never win over the container. */
const HOST_ENV = {
    PATH: '/host-fake/bin:/usr/bin',
    HOME: '/host-fake-home',
    LANG: 'C.UTF-8',
    API_CORS_ORIGINS: 'http://localhost:3000',
    HOSPEDA_X: 'host-leak'
} as const;

/** Container keys that legitimately reach the child. */
const EXPECTED_CONTAINER_KEYS = [
    ...REAL_API_KEYS,
    'PORT',
    'NODE_ENV',
    'HOSPEDA_DATABASE_URL',
    'HOSPEDA_BETTER_AUTH_SECRET',
    'HOSPEDA_COMMIT_SHA',
    'HOSPEDA_SENTRY_RELEASE'
];

/** Container keys plus the closed host allowlist. */
const EXPECTED_CHILD_ENV_KEYS = [...EXPECTED_CONTAINER_KEYS, 'PATH', 'HOME', 'LANG'].sort();

/** An execution input whose defaults pass every guard (staging dry-run). */
function execInput(overrides: Partial<ExecuteCutoverStep3Input> = {}): ExecuteCutoverStep3Input {
    return {
        runner: fakeRunner(0, []),
        repoRoot: 'repo-fake',
        target: 'staging',
        options: { mode: 'dry-run', allowShaMismatch: false, yes: false },
        containerEnv: REAL_CONTAINER_ENV,
        databaseUrl: DATABASE_URL,
        hostEnv: HOST_ENV,
        readCheckoutSha: async () => CHECKOUT_SHA,
        confirmProd: async () => {},
        log: { info: () => {}, warn: () => {} },
        ...overrides
    };
}

/** Replace one `KEY=VALUE` entry in the container fixture. */
function withEntry(
    containerEnv: ReadonlyArray<string>,
    key: string,
    value: string
): ReadonlyArray<string> {
    return containerEnv.map((entry) => (entry.startsWith(`${key}=`) ? `${key}=${value}` : entry));
}

// ---------------------------------------------------------------------------
// TEST:1745b:1 — the API_* surface, PORT, NODE_ENV and HOSPEDA_* reach the child
// ---------------------------------------------------------------------------

describe('buildStep3ChildEnv: container allowlist', () => {
    it('keeps every API_* key, PORT, NODE_ENV and HOSPEDA_* from the container', () => {
        const env = buildStep3ChildEnv({
            containerEnv: REAL_CONTAINER_ENV,
            databaseUrl: DATABASE_URL,
            hostEnv: HOST_ENV
        });

        for (const key of REAL_API_KEYS) {
            expect(env[key]).toBe(
                key === 'API_CORS_ORIGINS' ? 'https://fake.example.invalid' : 'fake-value'
            );
        }
        expect(env.API_CORS_ORIGINS).toBe('https://fake.example.invalid');
        expect(env.PORT).toBe('3001');
        expect(env.NODE_ENV).toBe('production');
        expect(env.HOSPEDA_BETTER_AUTH_SECRET).toBe('fake-secret');
        expect(env.HOSPEDA_SENTRY_RELEASE).toBe('fake-release');
        expect(env.HOSPEDA_COMMIT_SHA).toBe('');
    });

    // -----------------------------------------------------------------------
    // TEST:1745b:2 — nothing else from the container passes
    // -----------------------------------------------------------------------

    it('drops the container system entries and near-miss key names', () => {
        const env = buildStep3ChildEnv({
            containerEnv: REAL_CONTAINER_ENV,
            databaseUrl: DATABASE_URL,
            hostEnv: HOST_ENV
        });

        for (const key of [
            'SOURCE_COMMIT',
            'NODE_VERSION',
            'HOSTNAME',
            'APIX_FOO',
            'MY_API_KEY',
            'PORTAL',
            'PORT_X',
            'API'
        ]) {
            expect(env[key]).toBeUndefined();
        }

        expect(env.PATH).toBe(HOST_ENV.PATH);
        expect(env.HOME).toBe(HOST_ENV.HOME);
        expect(env.LANG).toBe(HOST_ENV.LANG);
        expect(Object.keys(env).sort()).toEqual(EXPECTED_CHILD_ENV_KEYS);
    });
});

// ---------------------------------------------------------------------------
// TEST:1745b:3 — the runner receives the built env with inheritEnv:false
// ---------------------------------------------------------------------------

describe('executeCutoverStep3: child env wiring', () => {
    it('runs with inheritEnv:false, the host DB URL and no host API_*/HOSPEDA_* leak', async () => {
        const calls: { argv: readonly string[]; options?: RunOptions }[] = [];
        let confirmations = 0;

        const result = await executeCutoverStep3(
            execInput({
                runner: fakeRunner(0, calls),
                confirmProd: async () => {
                    confirmations += 1;
                }
            })
        );

        expect(result).toEqual({ ok: true, exitCode: 0 });
        expect(calls.length).toBe(1);
        expect(calls[0]?.options?.inheritEnv).toBe(false);
        expect(calls[0]?.options?.env?.API_CORS_ORIGINS).toBe('https://fake.example.invalid');
        expect(calls[0]?.options?.env?.HOSPEDA_DATABASE_URL).toBe(DATABASE_URL);
        expect(calls[0]?.options?.env?.SOURCE_COMMIT).toBeUndefined();
        expect(calls[0]?.options?.env?.HOSPEDA_X).toBeUndefined();
        expect(confirmations).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// TEST:1745b:4 — resolveDeployedSha: HOSPEDA_COMMIT_SHA wins when valid
// ---------------------------------------------------------------------------

describe('resolveDeployedSha', () => {
    it('prefers a valid HOSPEDA_COMMIT_SHA over SOURCE_COMMIT', () => {
        expect(
            resolveDeployedSha({
                containerEnv: ['HOSPEDA_COMMIT_SHA=abc1234567', 'SOURCE_COMMIT=ffffffffff']
            })
        ).toBe('abc1234567');
    });

    it('falls back to SOURCE_COMMIT when HOSPEDA_COMMIT_SHA is empty', () => {
        expect(
            resolveDeployedSha({
                containerEnv: ['HOSPEDA_COMMIT_SHA=', 'SOURCE_COMMIT=ffffffffff']
            })
        ).toBe('ffffffffff');
    });

    it('falls back to SOURCE_COMMIT when HOSPEDA_COMMIT_SHA is only whitespace', () => {
        expect(
            resolveDeployedSha({
                containerEnv: ['HOSPEDA_COMMIT_SHA=   ', 'SOURCE_COMMIT=ffffffffff']
            })
        ).toBe('ffffffffff');
    });

    it('falls back to SOURCE_COMMIT when HOSPEDA_COMMIT_SHA is unknown, in any case', () => {
        expect(
            resolveDeployedSha({
                containerEnv: ['HOSPEDA_COMMIT_SHA=unknown', 'SOURCE_COMMIT=ffffffffff']
            })
        ).toBe('ffffffffff');
        expect(
            resolveDeployedSha({
                containerEnv: ['HOSPEDA_COMMIT_SHA=UNKNOWN', 'SOURCE_COMMIT=ffffffffff']
            })
        ).toBe('ffffffffff');
    });

    it('falls back to SOURCE_COMMIT when HOSPEDA_COMMIT_SHA is absent', () => {
        expect(resolveDeployedSha({ containerEnv: ['SOURCE_COMMIT=ffffffffff'] })).toBe(
            'ffffffffff'
        );
    });

    it('returns undefined when neither value is usable', () => {
        expect(
            resolveDeployedSha({ containerEnv: ['HOSPEDA_COMMIT_SHA=', 'SOURCE_COMMIT='] })
        ).toBeUndefined();
        expect(resolveDeployedSha({ containerEnv: ['HOSPEDA_COMMIT_SHA='] })).toBeUndefined();
        expect(
            resolveDeployedSha({ containerEnv: ['HOSPEDA_COMMIT_SHA=', 'SOURCE_COMMIT=unknown'] })
        ).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// TEST:1745b:5 — executeCutoverStep3 uses the fallback and the new guard message
// ---------------------------------------------------------------------------

describe('executeCutoverStep3: deployed SHA fallback', () => {
    it('runs on staging when HOSPEDA_COMMIT_SHA is empty and SOURCE_COMMIT matches HEAD', async () => {
        const calls: { argv: readonly string[]; options?: RunOptions }[] = [];

        const result = await executeCutoverStep3(
            execInput({ runner: fakeRunner(0, calls), containerEnv: REAL_CONTAINER_ENV })
        );

        expect(result).toEqual({ ok: true, exitCode: 0 });
        expect(calls.length).toBe(1);
    });

    it('stops with sha-guard and never runs when both SHAs are empty', async () => {
        const calls: { argv: readonly string[]; options?: RunOptions }[] = [];

        const result = await executeCutoverStep3(
            execInput({
                runner: fakeRunner(0, calls),
                containerEnv: withEntry(REAL_CONTAINER_ENV, 'SOURCE_COMMIT', '')
            })
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('sha-guard');
            expect(result.message).toContain('SOURCE_COMMIT');
        }
        expect(calls.length).toBe(0);
    });

    it('names both variables when no deployed SHA is available', () => {
        const result = checkDeployedSha({
            checkoutSha: CHECKOUT_SHA,
            deployedSha: undefined,
            allowMismatch: false
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toContain('neither HOSPEDA_COMMIT_SHA nor SOURCE_COMMIT');
        }
    });

    it('does not fall back when HOSPEDA_COMMIT_SHA is valid but mismatched', async () => {
        const calls: { argv: readonly string[]; options?: RunOptions }[] = [];

        const result = await executeCutoverStep3(
            execInput({
                runner: fakeRunner(0, calls),
                containerEnv: withEntry(REAL_CONTAINER_ENV, 'HOSPEDA_COMMIT_SHA', 'ffffffffff')
            })
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('sha-guard');
        expect(calls.length).toBe(0);
    });

    it('runs a prod dry-run without the typed confirmation when the SHA matches', async () => {
        const calls: { argv: readonly string[]; options?: RunOptions }[] = [];
        let confirmations = 0;

        const result = await executeCutoverStep3(
            execInput({
                runner: fakeRunner(0, calls),
                target: 'prod',
                containerEnv: withEntry(REAL_CONTAINER_ENV, 'HOSPEDA_COMMIT_SHA', DEPLOYED_SHA),
                confirmProd: async () => {
                    confirmations += 1;
                }
            })
        );

        expect(result).toEqual({ ok: true, exitCode: 0 });
        expect(calls.length).toBe(1);
        expect(confirmations).toBe(0);
    });
});
