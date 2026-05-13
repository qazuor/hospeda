/**
 * Unit tests for `src/lib/target.ts` — resolveTarget(argv) and the
 * resource-name + DB credential helpers.
 *
 * SPEC-103 T-038 (resolveTarget) + T-039 (getAppResourceName,
 * getDbResourceName, getDbCredentials).
 *
 * Inputs come from process.env via the `get()` accessor in lib/env.ts.
 * Each test sets/resets the relevant env vars to keep cases isolated.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
    getAppResourceName,
    getDbCredentials,
    getDbResourceName,
    resolveTarget
} from '../src/lib/target.ts';

const ENV_KEYS_TOUCHED = [
    'HOPS_DEFAULT_TARGET',
    'HOPS_PROD_POSTGRES_UUID',
    'HOPS_STAGING_POSTGRES_UUID',
    'HOPS_PROD_REDIS_UUID',
    'HOPS_STAGING_REDIS_UUID',
    'HOPS_PROD_PG_USER',
    'HOPS_PROD_PG_DB',
    'HOPS_STAGING_PG_USER',
    'HOPS_STAGING_PG_DB',
    'PG_USER',
    'PG_DB'
] as const;

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
    originalEnv = {};
    for (const key of ENV_KEYS_TOUCHED) {
        originalEnv[key] = process.env[key];
        delete process.env[key];
    }
});

afterEach(() => {
    for (const key of ENV_KEYS_TOUCHED) {
        if (originalEnv[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = originalEnv[key];
        }
    }
});

describe('resolveTarget(argv)', () => {
    it('defaults to prod when no flag, no env var', () => {
        const result = resolveTarget(['logs', 'api']);
        expect(result.target).toBe('prod');
        expect(result.remainingArgv).toEqual(['logs', 'api']);
    });

    it('parses --target=staging (single token)', () => {
        const result = resolveTarget(['--target=staging', 'logs', 'api']);
        expect(result.target).toBe('staging');
        expect(result.remainingArgv).toEqual(['logs', 'api']);
    });

    it('parses --target staging (two tokens)', () => {
        const result = resolveTarget(['--target', 'staging', 'logs', 'api']);
        expect(result.target).toBe('staging');
        expect(result.remainingArgv).toEqual(['logs', 'api']);
    });

    it('parses --target=prod and strips it from argv', () => {
        const result = resolveTarget(['logs', '--target=prod', 'api']);
        expect(result.target).toBe('prod');
        expect(result.remainingArgv).toEqual(['logs', 'api']);
    });

    it('falls back to HOPS_DEFAULT_TARGET when no flag is given', () => {
        process.env.HOPS_DEFAULT_TARGET = 'staging';
        const result = resolveTarget(['health']);
        expect(result.target).toBe('staging');
    });

    it('CLI flag overrides HOPS_DEFAULT_TARGET', () => {
        process.env.HOPS_DEFAULT_TARGET = 'staging';
        const result = resolveTarget(['--target=prod', 'health']);
        expect(result.target).toBe('prod');
    });

    it('throws for an invalid target value', () => {
        expect(() => resolveTarget(['--target=production', 'health'])).toThrow(
            /Invalid target 'production'/
        );
    });

    it('throws for an invalid HOPS_DEFAULT_TARGET value', () => {
        process.env.HOPS_DEFAULT_TARGET = 'dev';
        expect(() => resolveTarget(['health'])).toThrow(/Invalid target 'dev'/);
    });

    it('returns empty remainingArgv when only the flag is present', () => {
        const result = resolveTarget(['--target=staging']);
        expect(result.target).toBe('staging');
        expect(result.remainingArgv).toEqual([]);
    });

    it('preserves order of remaining argv tokens', () => {
        const result = resolveTarget(['exec', '--target=staging', 'api', '--', 'node', '-v']);
        expect(result.target).toBe('staging');
        expect(result.remainingArgv).toEqual(['exec', 'api', '--', 'node', '-v']);
    });
});

describe('getAppResourceName(target, kind)', () => {
    it('returns hospeda-api-prod for (prod, api)', () => {
        expect(getAppResourceName('prod', 'api')).toBe('hospeda-api-prod');
    });

    it('returns hospeda-web-prod for (prod, web)', () => {
        expect(getAppResourceName('prod', 'web')).toBe('hospeda-web-prod');
    });

    it('returns hospeda-admin-prod for (prod, admin)', () => {
        expect(getAppResourceName('prod', 'admin')).toBe('hospeda-admin-prod');
    });

    it('returns hospeda-api-staging for (staging, api)', () => {
        expect(getAppResourceName('staging', 'api')).toBe('hospeda-api-staging');
    });

    it('returns hospeda-web-staging for (staging, web)', () => {
        expect(getAppResourceName('staging', 'web')).toBe('hospeda-web-staging');
    });

    it('returns hospeda-admin-staging for (staging, admin)', () => {
        expect(getAppResourceName('staging', 'admin')).toBe('hospeda-admin-staging');
    });
});

describe('getDbResourceName(target, kind)', () => {
    it('returns postgresql-database-<UUID> for prod postgres', () => {
        process.env.HOPS_PROD_POSTGRES_UUID = 'abc123def456ghi789jkl012';
        expect(getDbResourceName('prod', 'postgres')).toBe(
            'postgresql-database-abc123def456ghi789jkl012'
        );
    });

    it('returns postgresql-database-<UUID> for staging postgres', () => {
        process.env.HOPS_STAGING_POSTGRES_UUID = 'qqwydyilhgifup0wsb2v27uq';
        expect(getDbResourceName('staging', 'postgres')).toBe(
            'postgresql-database-qqwydyilhgifup0wsb2v27uq'
        );
    });

    it('returns redis-database-<UUID> for prod redis', () => {
        process.env.HOPS_PROD_REDIS_UUID = 'redis-uuid-prod-xyz';
        expect(getDbResourceName('prod', 'redis')).toBe('redis-database-redis-uuid-prod-xyz');
    });

    it('returns redis-database-<UUID> for staging redis', () => {
        process.env.HOPS_STAGING_REDIS_UUID = 'redis-uuid-staging-abc';
        expect(getDbResourceName('staging', 'redis')).toBe('redis-database-redis-uuid-staging-abc');
    });

    it('throws with an actionable message when the UUID env var is missing', () => {
        expect(() => getDbResourceName('prod', 'postgres')).toThrow(
            /HOPS_PROD_POSTGRES_UUID is not set in \.env\.local/
        );
    });

    it('error message names the exact env var the operator must set', () => {
        try {
            getDbResourceName('staging', 'redis');
            throw new Error('expected getDbResourceName to throw');
        } catch (err) {
            expect((err as Error).message).toContain('HOPS_STAGING_REDIS_UUID');
        }
    });
});

describe('getDbCredentials(target)', () => {
    describe('defaults', () => {
        it('returns postgres/postgres for prod when no overrides set', () => {
            expect(getDbCredentials('prod')).toEqual({
                user: 'postgres',
                database: 'postgres'
            });
        });

        it('returns hospeda_staging_user/hospeda_staging for staging when no overrides set', () => {
            expect(getDbCredentials('staging')).toEqual({
                user: 'hospeda_staging_user',
                database: 'hospeda_staging'
            });
        });
    });

    describe('target-prefixed overrides', () => {
        it('HOPS_PROD_PG_USER overrides the prod user', () => {
            process.env.HOPS_PROD_PG_USER = 'custom_prod_user';
            expect(getDbCredentials('prod').user).toBe('custom_prod_user');
        });

        it('HOPS_PROD_PG_DB overrides the prod database', () => {
            process.env.HOPS_PROD_PG_DB = 'custom_prod_db';
            expect(getDbCredentials('prod').database).toBe('custom_prod_db');
        });

        it('HOPS_STAGING_PG_USER overrides the staging user', () => {
            process.env.HOPS_STAGING_PG_USER = 'custom_staging_user';
            expect(getDbCredentials('staging').user).toBe('custom_staging_user');
        });

        it('HOPS_STAGING_PG_DB overrides the staging database', () => {
            process.env.HOPS_STAGING_PG_DB = 'custom_staging_db';
            expect(getDbCredentials('staging').database).toBe('custom_staging_db');
        });
    });

    describe('legacy PG_USER / PG_DB (prod only, back-compat)', () => {
        it('PG_USER is honoured for prod', () => {
            process.env.PG_USER = 'legacy_user';
            expect(getDbCredentials('prod').user).toBe('legacy_user');
        });

        it('PG_DB is honoured for prod', () => {
            process.env.PG_DB = 'legacy_db';
            expect(getDbCredentials('prod').database).toBe('legacy_db');
        });

        it('PG_USER is IGNORED for staging (back-compat covers prod only)', () => {
            process.env.PG_USER = 'legacy_user';
            expect(getDbCredentials('staging').user).toBe('hospeda_staging_user');
        });

        it('PG_DB is IGNORED for staging (back-compat covers prod only)', () => {
            process.env.PG_DB = 'legacy_db';
            expect(getDbCredentials('staging').database).toBe('hospeda_staging');
        });
    });

    describe('precedence', () => {
        it('target-prefixed override beats legacy PG_USER for prod', () => {
            process.env.PG_USER = 'legacy_user';
            process.env.HOPS_PROD_PG_USER = 'targeted_user';
            expect(getDbCredentials('prod').user).toBe('targeted_user');
        });

        it('target-prefixed override beats legacy PG_DB for prod', () => {
            process.env.PG_DB = 'legacy_db';
            process.env.HOPS_PROD_PG_DB = 'targeted_db';
            expect(getDbCredentials('prod').database).toBe('targeted_db');
        });
    });
});
