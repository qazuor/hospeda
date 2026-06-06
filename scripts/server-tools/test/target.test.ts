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
    type TargetSource,
    getAppResourceName,
    getDbCredentials,
    getDbResourceName,
    getR2Config,
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
    'PG_DB',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'R2_STAGING_ACCOUNT_ID',
    'R2_STAGING_ACCESS_KEY_ID',
    'R2_STAGING_SECRET_ACCESS_KEY',
    'R2_STAGING_BUCKET'
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
    describe('no flag, no env var', () => {
        it('returns target=undefined, source=none when neither flag nor env var is set', () => {
            const result = resolveTarget(['logs', 'api']);
            expect(result.target).toBeUndefined();
            expect(result.source).toBe('none' satisfies TargetSource);
            expect(result.remainingArgv).toEqual(['logs', 'api']);
        });

        it('does NOT fall back to prod silently', () => {
            const result = resolveTarget([]);
            expect(result.target).toBeUndefined();
            expect(result.source).toBe('none');
        });
    });

    describe('--target= flag', () => {
        it('parses --target=staging (single token)', () => {
            const result = resolveTarget(['--target=staging', 'logs', 'api']);
            expect(result.target).toBe('staging');
            expect(result.source).toBe('flag' satisfies TargetSource);
            expect(result.remainingArgv).toEqual(['logs', 'api']);
        });

        it('parses --target staging (two tokens)', () => {
            const result = resolveTarget(['--target', 'staging', 'logs', 'api']);
            expect(result.target).toBe('staging');
            expect(result.source).toBe('flag');
            expect(result.remainingArgv).toEqual(['logs', 'api']);
        });

        it('parses --target=prod and strips it from argv', () => {
            const result = resolveTarget(['logs', '--target=prod', 'api']);
            expect(result.target).toBe('prod');
            expect(result.source).toBe('flag');
            expect(result.remainingArgv).toEqual(['logs', 'api']);
        });

        it('returns empty remainingArgv when only the flag is present', () => {
            const result = resolveTarget(['--target=staging']);
            expect(result.target).toBe('staging');
            expect(result.source).toBe('flag');
            expect(result.remainingArgv).toEqual([]);
        });

        it('preserves order of remaining argv tokens', () => {
            const result = resolveTarget(['exec', '--target=staging', 'api', '--', 'node', '-v']);
            expect(result.target).toBe('staging');
            expect(result.source).toBe('flag');
            expect(result.remainingArgv).toEqual(['exec', 'api', '--', 'node', '-v']);
        });

        it('throws for an invalid --target value', () => {
            expect(() => resolveTarget(['--target=production', 'health'])).toThrow(
                /Invalid --target value 'production'/
            );
        });
    });

    describe('HOPS_DEFAULT_TARGET env var', () => {
        it('uses HOPS_DEFAULT_TARGET when no flag is given', () => {
            process.env.HOPS_DEFAULT_TARGET = 'staging';
            const result = resolveTarget(['db-counts']);
            expect(result.target).toBe('staging');
            expect(result.source).toBe('env' satisfies TargetSource);
        });

        it('CLI flag overrides HOPS_DEFAULT_TARGET (flag wins)', () => {
            process.env.HOPS_DEFAULT_TARGET = 'staging';
            const result = resolveTarget(['--target=prod', 'db-counts']);
            expect(result.target).toBe('prod');
            expect(result.source).toBe('flag');
        });

        it('throws for an invalid HOPS_DEFAULT_TARGET value', () => {
            process.env.HOPS_DEFAULT_TARGET = 'dev';
            expect(() => resolveTarget(['db-counts'])).toThrow(
                /Invalid HOPS_DEFAULT_TARGET value 'dev'/
            );
        });
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

describe('getR2Config(target)', () => {
    describe('prod target reads unprefixed R2_* vars', () => {
        it('returns all four values when every var is set', () => {
            process.env.R2_ACCOUNT_ID = 'prod-account';
            process.env.R2_ACCESS_KEY_ID = 'prod-key';
            process.env.R2_SECRET_ACCESS_KEY = 'prod-secret';
            process.env.R2_BUCKET = 'hospeda-backups';
            expect(getR2Config('prod')).toEqual({
                accountId: 'prod-account',
                accessKeyId: 'prod-key',
                secretAccessKey: 'prod-secret',
                bucket: 'hospeda-backups'
            });
        });

        it('throws naming the missing prod var', () => {
            process.env.R2_ACCESS_KEY_ID = 'prod-key';
            process.env.R2_SECRET_ACCESS_KEY = 'prod-secret';
            process.env.R2_BUCKET = 'hospeda-backups';
            // R2_ACCOUNT_ID missing
            expect(() => getR2Config('prod')).toThrow(/R2_ACCOUNT_ID/);
        });

        it('does NOT fall back to R2_STAGING_* values', () => {
            process.env.R2_STAGING_ACCOUNT_ID = 'staging-account';
            process.env.R2_STAGING_ACCESS_KEY_ID = 'staging-key';
            process.env.R2_STAGING_SECRET_ACCESS_KEY = 'staging-secret';
            process.env.R2_STAGING_BUCKET = 'hospeda-staging-backups';
            // No R2_* set
            expect(() => getR2Config('prod')).toThrow(/R2_ACCOUNT_ID/);
        });
    });

    describe('staging target reads R2_STAGING_* vars', () => {
        it('returns all four values when every var is set', () => {
            process.env.R2_STAGING_ACCOUNT_ID = 'staging-account';
            process.env.R2_STAGING_ACCESS_KEY_ID = 'staging-key';
            process.env.R2_STAGING_SECRET_ACCESS_KEY = 'staging-secret';
            process.env.R2_STAGING_BUCKET = 'hospeda-staging-backups';
            expect(getR2Config('staging')).toEqual({
                accountId: 'staging-account',
                accessKeyId: 'staging-key',
                secretAccessKey: 'staging-secret',
                bucket: 'hospeda-staging-backups'
            });
        });

        it('throws naming the missing staging var', () => {
            process.env.R2_STAGING_ACCOUNT_ID = 'staging-account';
            process.env.R2_STAGING_ACCESS_KEY_ID = 'staging-key';
            process.env.R2_STAGING_SECRET_ACCESS_KEY = 'staging-secret';
            // R2_STAGING_BUCKET missing
            expect(() => getR2Config('staging')).toThrow(/R2_STAGING_BUCKET/);
        });

        it('does NOT fall back to prod R2_* values', () => {
            process.env.R2_ACCOUNT_ID = 'prod-account';
            process.env.R2_ACCESS_KEY_ID = 'prod-key';
            process.env.R2_SECRET_ACCESS_KEY = 'prod-secret';
            process.env.R2_BUCKET = 'hospeda-backups';
            // No R2_STAGING_* set
            expect(() => getR2Config('staging')).toThrow(/R2_STAGING_ACCOUNT_ID/);
        });
    });

    describe('isolation between targets', () => {
        it('prod and staging configs are completely independent', () => {
            process.env.R2_ACCOUNT_ID = 'prod-account';
            process.env.R2_ACCESS_KEY_ID = 'prod-key';
            process.env.R2_SECRET_ACCESS_KEY = 'prod-secret';
            process.env.R2_BUCKET = 'hospeda-backups';
            process.env.R2_STAGING_ACCOUNT_ID = 'staging-account';
            process.env.R2_STAGING_ACCESS_KEY_ID = 'staging-key';
            process.env.R2_STAGING_SECRET_ACCESS_KEY = 'staging-secret';
            process.env.R2_STAGING_BUCKET = 'hospeda-staging-backups';

            const prod = getR2Config('prod');
            const staging = getR2Config('staging');

            expect(prod.accountId).toBe('prod-account');
            expect(staging.accountId).toBe('staging-account');
            expect(prod.bucket).toBe('hospeda-backups');
            expect(staging.bucket).toBe('hospeda-staging-backups');
        });
    });
});
