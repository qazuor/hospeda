/**
 * Proves the B9a step 3b operator script exits by itself (HOS-2115).
 *
 * On staging the script printed its JSON result and then never exited, so
 * `timeout` killed it with 124. The leaked handle was the Mercado Pago traffic
 * governor's Redis cool-down client: in `enforce` mode it retries forever, and
 * with an unreachable Redis its reconnect timer kept the event loop alive with
 * no socket open. This test spawns the real script with that exact shape (an
 * enforcing governor and a Redis nobody listens on) over a Postgres nobody
 * listens on, so the run fails fast on the error path and must still exit on
 * its own within the deadline. A hang is reported as a kill by the deadline.
 */
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_ROOT = resolve(import.meta.dirname, '../..');
const SCRIPT = join(API_ROOT, 'scripts/cutover-b9a-step-3b.ts');
const EXIT_DEADLINE_MS = 90_000;

/** Nothing listens on port 1, so both connections are refused immediately. */
const UNREACHABLE_REDIS_URL = 'redis://127.0.0.1:1';
const UNREACHABLE_DATABASE_URL = 'postgresql://cutover:cutover@127.0.0.1:1/cutover';

/** The closed child environment: only what `validateApiEnv()` requires plus the failure shape. */
function childEnv(): NodeJS.ProcessEnv {
    const secret = 'hos-2115-test-secret-at-least-32-characters';
    return {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: 'development',
        HOSPEDA_API_URL: 'http://localhost:3001',
        HOSPEDA_SITE_URL: 'http://localhost:4321',
        HOSPEDA_ADMIN_URL: 'http://localhost:3000',
        HOSPEDA_DATABASE_URL: UNREACHABLE_DATABASE_URL,
        HOSPEDA_REDIS_URL: UNREACHABLE_REDIS_URL,
        HOSPEDA_MERCADO_PAGO_GOVERNOR_MODE: 'enforce',
        HOSPEDA_BETTER_AUTH_SECRET: secret,
        HOSPEDA_BETTER_AUTH_URL: 'http://localhost:3001/api/auth',
        HOSPEDA_LOCATION_SALT: secret,
        HOSPEDA_VIEWS_HASH_SECRET: secret,
        HOSPEDA_REVALIDATION_SECRET: secret,
        HOSPEDA_NEWSLETTER_HMAC_SECRET: secret
    };
}

describe('TEST:2115:1 cutover step 3b script exits by itself', () => {
    it(
        'exits with code 1 on the error path while an enforcing governor cannot reach Redis',
        () => {
            // Arrange
            const args = [
                '--dry-run',
                '--actor-user-id=11111111-1111-4111-8111-111111111111',
                '--beneficiary=22222222-2222-4222-8222-222222222222',
                '--beneficiary=33333333-3333-4333-8333-333333333333',
                '--plan-id=44444444-4444-4444-8444-444444444444',
                '--floor-plan-version-id=55555555-5555-4555-8555-555555555555',
                '--includes-addons=false'
            ];

            // Act
            const child = spawnSync(process.execPath, ['--import', 'tsx', SCRIPT, ...args], {
                cwd: API_ROOT,
                env: childEnv(),
                encoding: 'utf8',
                timeout: EXIT_DEADLINE_MS,
                killSignal: 'SIGKILL'
            });

            // Assert
            const details = [
                `exit=${child.status}`,
                `signal=${child.signal}`,
                `error=${child.error?.message ?? 'none'}`,
                `stdout:\n${child.stdout}`,
                `stderr:\n${child.stderr}`
            ].join('\n');
            expect(child.signal, details).toBeNull();
            expect(child.status, details).toBe(1);
            expect(child.stderr, details).toContain('Step3bOperatorUnresolvedError');
        },
        EXIT_DEADLINE_MS + 30_000
    );
});
