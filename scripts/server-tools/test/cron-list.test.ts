/**
 * `cron-list` honours `--target` (HOS-1950). `fetchCronJobs` is what both
 * `cron-list` and `cron-trigger` call first, so pinning the URL it hits
 * covers both commands' read path.
 *
 * `fetch` is replaced with a recorder; nothing leaves the process.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { fetchCronJobs } from '../src/commands/cron-list.ts';
import { setActiveTarget } from '../src/lib/container-lookup.ts';

const ENV_KEYS_TOUCHED = [
    'HOSPEDA_API_URL',
    'HOPS_ADMIN_COOKIE',
    'HOPS_STAGING_API_URL',
    'HOPS_STAGING_ADMIN_COOKIE'
] as const;

let originalEnv: Record<string, string | undefined>;
const originalFetch = globalThis.fetch;
let calls: Array<{ url: string; cookie: string | null }>;

beforeEach(() => {
    originalEnv = {};
    for (const key of ENV_KEYS_TOUCHED) {
        originalEnv[key] = process.env[key];
        delete process.env[key];
    }
    calls = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        calls.push({ url: String(input), cookie: headers.get('Cookie') });
        return new Response(
            JSON.stringify({
                success: true,
                data: { jobs: [], totalJobs: 0, enabledJobs: 0 }
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    }) as typeof fetch;
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const key of ENV_KEYS_TOUCHED) {
        if (originalEnv[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = originalEnv[key];
        }
    }
});

describe('fetchCronJobs — target routing', () => {
    it('hits the staging API with the staging cookie under --target=staging', async () => {
        // Arrange
        process.env.HOSPEDA_API_URL = 'https://api.hospeda.com.ar';
        process.env.HOPS_ADMIN_COOKIE = 'prod-cookie';
        process.env.HOPS_STAGING_API_URL = 'https://staging-api.hospeda.com.ar';
        process.env.HOPS_STAGING_ADMIN_COOKIE = 'staging-cookie';
        setActiveTarget('staging');

        // Act
        await fetchCronJobs();

        // Assert
        expect(calls).toHaveLength(1);
        expect(calls[0]?.url).toBe('https://staging-api.hospeda.com.ar/api/v1/admin/cron');
        expect(calls[0]?.cookie).toBe('staging-cookie');
    });

    it('makes no request at all when staging has no URL configured', async () => {
        process.env.HOSPEDA_API_URL = 'https://api.hospeda.com.ar';
        process.env.HOPS_ADMIN_COOKIE = 'prod-cookie';
        setActiveTarget('staging');

        await expect(fetchCronJobs()).rejects.toThrow(/HOPS_STAGING_API_URL is not set/);
        expect(calls).toHaveLength(0);
    });

    it('still hits the prod API under --target=prod', async () => {
        process.env.HOPS_ADMIN_COOKIE = 'prod-cookie';
        setActiveTarget('prod');

        await fetchCronJobs();

        expect(calls[0]?.url).toBe('https://api.hospeda.com.ar/api/v1/admin/cron');
        expect(calls[0]?.cookie).toBe('prod-cookie');
    });
});
