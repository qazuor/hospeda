/**
 * Unit tests for `resolveApiEndpoint` in `src/lib/api-client.ts`
 * (HOS-1950): `cron-list` / `cron-trigger` must honour `--target`, and a
 * staging run must never reach the prod API URL or carry the prod cookie.
 *
 * Inputs come from process.env via `get()` in lib/env.ts; each test resets
 * the variables it touches.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { PROD_API_DEFAULT_URL, resolveApiEndpoint } from '../src/lib/api-client.ts';

const ENV_KEYS_TOUCHED = [
    'HOSPEDA_API_URL',
    'HOPS_ADMIN_COOKIE',
    'HOPS_STAGING_API_URL',
    'HOPS_STAGING_ADMIN_COOKIE'
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

describe('resolveApiEndpoint — staging', () => {
    it('does not use the prod URL or prod cookie for staging', () => {
        // Arrange: the VPS file carries the prod pair AND the staging pair.
        process.env.HOSPEDA_API_URL = 'https://api.hospeda.com.ar';
        process.env.HOPS_ADMIN_COOKIE = 'prod-cookie';
        process.env.HOPS_STAGING_API_URL = 'https://staging-api.hospeda.com.ar/';
        process.env.HOPS_STAGING_ADMIN_COOKIE = 'staging-cookie';

        // Act
        const endpoint = resolveApiEndpoint({ target: 'staging' });

        // Assert
        expect(endpoint.baseUrl).toBe('https://staging-api.hospeda.com.ar');
        expect(endpoint.cookie).toBe('staging-cookie');
        expect(endpoint.baseUrl).not.toContain('//api.hospeda.com.ar');
    });

    it('errors (never prod) when no staging URL is configured', () => {
        process.env.HOSPEDA_API_URL = 'https://api.hospeda.com.ar';
        process.env.HOPS_ADMIN_COOKIE = 'prod-cookie';
        process.env.HOPS_STAGING_ADMIN_COOKIE = 'staging-cookie';

        expect(() => resolveApiEndpoint({ target: 'staging' })).toThrow(
            /HOPS_STAGING_API_URL is not set/
        );
    });

    it('errors when the staging URL points at the prod host', () => {
        process.env.HOPS_STAGING_API_URL = `${PROD_API_DEFAULT_URL}/`;
        process.env.HOPS_STAGING_ADMIN_COOKIE = 'staging-cookie';

        expect(() => resolveApiEndpoint({ target: 'staging' })).toThrow(
            /same host as the prod API/
        );
    });

    it('errors instead of sending the prod cookie when the staging cookie is missing', () => {
        process.env.HOPS_ADMIN_COOKIE = 'prod-cookie';
        process.env.HOPS_STAGING_API_URL = 'https://staging-api.hospeda.com.ar';

        expect(() => resolveApiEndpoint({ target: 'staging' })).toThrow(
            /HOPS_STAGING_ADMIN_COOKIE is not set/
        );
    });
});

describe('resolveApiEndpoint — prod (back-compat)', () => {
    it('defaults to the public prod URL', () => {
        process.env.HOPS_ADMIN_COOKIE = 'prod-cookie';

        const endpoint = resolveApiEndpoint({ target: 'prod' });

        expect(endpoint.baseUrl).toBe(PROD_API_DEFAULT_URL);
        expect(endpoint.cookie).toBe('prod-cookie');
    });

    it('honours HOSPEDA_API_URL and ignores the staging variables', () => {
        process.env.HOSPEDA_API_URL = 'https://api.example.test/';
        process.env.HOPS_ADMIN_COOKIE = 'prod-cookie';
        process.env.HOPS_STAGING_API_URL = 'https://staging-api.hospeda.com.ar';
        process.env.HOPS_STAGING_ADMIN_COOKIE = 'staging-cookie';

        const endpoint = resolveApiEndpoint({ target: 'prod' });

        expect(endpoint.baseUrl).toBe('https://api.example.test');
        expect(endpoint.cookie).toBe('prod-cookie');
    });
});
