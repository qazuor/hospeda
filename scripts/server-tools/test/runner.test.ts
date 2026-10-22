/**
 * Unit tests for the `Runner` env policy.
 *
 * `resolveChildEnv` is the pure merge rule; `LocalRunner` is exercised once
 * with a real child so the execa wiring (`extendEnv`) is covered too. No
 * Docker and no database involved.
 */

import { describe, expect, it } from 'bun:test';
import { LocalRunner, resolveChildEnv } from '../src/lib/runner.ts';

const HOST_ENV = {
    PATH: '/usr/local/bin:/usr/bin',
    HOME: '/root',
    SECRET_X: 'do-not-leak',
    NODE_OPTIONS: '--max-old-space-size=512',
    HOSPEDA_DATABASE_URL: 'postgresql://host-leak/db'
} as const;

/** Child script that dumps its own environment as JSON. */
const PRINT_ENV = 'console.log(JSON.stringify(process.env))';

describe('resolveChildEnv', () => {
    it('merges the host env by default', () => {
        const env = resolveChildEnv({
            env: { NODE_ENV: 'production' },
            hostEnv: HOST_ENV
        });
        expect(env).toEqual({ ...HOST_ENV, NODE_ENV: 'production' });
    });

    it('uses only the given env when inheritEnv is false', () => {
        const env = resolveChildEnv({
            env: { PATH: '/usr/bin', NODE_ENV: 'production' },
            inheritEnv: false,
            hostEnv: HOST_ENV
        });
        expect(env).toEqual({ PATH: '/usr/bin', NODE_ENV: 'production' });
        expect(env?.SECRET_X).toBeUndefined();
        expect(env?.NODE_OPTIONS).toBeUndefined();
        expect(env?.HOSPEDA_DATABASE_URL).toBeUndefined();
    });

    it('returns an empty env when inheritEnv is false and no env is given', () => {
        expect(resolveChildEnv({ inheritEnv: false, hostEnv: HOST_ENV })).toEqual({});
    });
});

describe('LocalRunner', () => {
    it('does not leak host-only variables when inheritEnv is false', async () => {
        process.env.HOSPEDA_RUNNER_HOST_ONLY_TEST = 'leak';
        try {
            const result = await new LocalRunner().run([process.execPath, '-e', PRINT_ENV], {
                env: {
                    PATH: process.env.PATH ?? '',
                    HOME: process.env.HOME ?? '',
                    LANG: process.env.LANG ?? '',
                    STEP3_MARKER: 'ok'
                },
                inheritEnv: false
            });

            expect(result.exitCode).toBe(0);
            const childEnv = JSON.parse(result.stdout) as Record<string, string>;
            expect(childEnv.STEP3_MARKER).toBe('ok');
            expect(childEnv.HOSPEDA_RUNNER_HOST_ONLY_TEST).toBeUndefined();
        } finally {
            delete process.env.HOSPEDA_RUNNER_HOST_ONLY_TEST;
        }
    });

    it('inherits host variables by default', async () => {
        process.env.HOSPEDA_RUNNER_HOST_ONLY_TEST = 'leak';
        try {
            const result = await new LocalRunner().run([process.execPath, '-e', PRINT_ENV], {
                env: { STEP3_MARKER: 'ok' }
            });

            expect(result.exitCode).toBe(0);
            const childEnv = JSON.parse(result.stdout) as Record<string, string>;
            expect(childEnv.STEP3_MARKER).toBe('ok');
            expect(childEnv.HOSPEDA_RUNNER_HOST_ONLY_TEST).toBe('leak');
        } finally {
            delete process.env.HOSPEDA_RUNNER_HOST_ONLY_TEST;
        }
    });
});
