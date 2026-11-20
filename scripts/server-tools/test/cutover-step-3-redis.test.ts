/**
 * HOS-2365: the host-run cutover steps must reach Redis from the VPS host.
 * Pure functions plus an injected port lookup: no Docker, no network.
 */

import { describe, expect, it } from 'bun:test';
import {
    buildStep3ChildEnv,
    resolveRedisHostPort,
    rewriteRedisUrlHost
} from '../src/lib/cutover-step-3-env.ts';

const INTERNAL_URL = 'redis://default:p%40ss%3Aword@redis-database-abc123:6379/2?family=4';
const DB_URL = 'postgresql://u:p@127.0.0.1:5432/db';

describe('rewriteRedisUrlHost', () => {
    it('replaces host and port and keeps scheme, credentials, db index and query', () => {
        // Arrange / Act
        const result = rewriteRedisUrlHost({ redisUrl: INTERNAL_URL, hostPort: '127.0.0.1:6380' });

        // Assert
        expect(result).toBe('redis://default:p%40ss%3Aword@127.0.0.1:6380/2?family=4');
    });

    it('does not leak the URL in the parse error', () => {
        expect(() =>
            rewriteRedisUrlHost({ redisUrl: 'not a url', hostPort: '127.0.0.1:6379' })
        ).toThrow(/not a valid URL/);
    });
});

describe('buildStep3ChildEnv Redis rewrite', () => {
    const containerEnv = [`HOSPEDA_REDIS_URL=${INTERNAL_URL}`, 'HOSPEDA_OTHER=x'];

    it('rewrites HOSPEDA_REDIS_URL to the host address', () => {
        const env = buildStep3ChildEnv({
            containerEnv,
            databaseUrl: DB_URL,
            hostEnv: {},
            redisHostPort: '127.0.0.1:6379'
        });

        expect(env.HOSPEDA_REDIS_URL).toBe(
            'redis://default:p%40ss%3Aword@127.0.0.1:6379/2?family=4'
        );
        expect(env.HOSPEDA_OTHER).toBe('x');
    });

    it('leaves Postgres behaviour unchanged', () => {
        const env = buildStep3ChildEnv({
            containerEnv: [...containerEnv, 'HOSPEDA_DATABASE_URL=postgresql://internal/x'],
            databaseUrl: DB_URL,
            hostEnv: {},
            redisHostPort: '127.0.0.1:6379'
        });

        expect(env.HOSPEDA_DATABASE_URL).toBe(DB_URL);
    });

    it('does not touch the Redis URL when no host port is given', () => {
        const env = buildStep3ChildEnv({ containerEnv, databaseUrl: DB_URL, hostEnv: {} });

        expect(env.HOSPEDA_REDIS_URL).toBe(INTERNAL_URL);
    });
});

describe('resolveRedisHostPort', () => {
    it('returns the published host:port when the api has a Redis URL', async () => {
        const result = await resolveRedisHostPort({
            containerEnv: [`HOSPEDA_REDIS_URL=${INTERNAL_URL}`],
            lookupHostPort: async () => '127.0.0.1:6379'
        });

        expect(result).toBe('127.0.0.1:6379');
    });

    it('fails loudly, without leaking the password, when Redis is not published', async () => {
        const run = resolveRedisHostPort({
            containerEnv: [`HOSPEDA_REDIS_URL=${INTERNAL_URL}`],
            lookupHostPort: async () => null
        });

        await expect(run).rejects.toThrow(/does not publish port 6379/);
        await expect(run).rejects.not.toThrow(/p%40ss/);
    });

    it('skips the lookup when the api has no Redis URL', async () => {
        let called = false;
        const result = await resolveRedisHostPort({
            containerEnv: ['HOSPEDA_OTHER=x'],
            lookupHostPort: async () => {
                called = true;
                return null;
            }
        });

        expect(result).toBeUndefined();
        expect(called).toBe(false);
    });
});
