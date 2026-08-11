/**
 * @file cloudflare-purge.test.ts
 * @description Tests for the shared Cloudflare purge client (HOS-427).
 *
 * The case that justifies this module existing once instead of twice is
 * `treats a 200 with success:false as a failure`. Cloudflare answers several
 * validation and entitlement failures with HTTP 200 and `success: false`, so a
 * caller that checked only the status line would log a purge that evicted
 * nothing as a success and leave the content stale for its whole TTL.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildCloudflarePurgeEndpoint,
    purgeCloudflare,
    readCloudflareCredentials
} from '../../../src/lib/cache/cloudflare-purge';

const ZONE = 'zone-abc';
const TOKEN = 'token-xyz';

let fetchMock: ReturnType<typeof vi.fn>;
let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('buildCloudflarePurgeEndpoint', () => {
    it('targets the v4 purge_cache endpoint for the zone', () => {
        expect(buildCloudflarePurgeEndpoint({ zoneId: ZONE })).toBe(
            `https://api.cloudflare.com/client/v4/zones/${ZONE}/purge_cache`
        );
    });
});

describe('readCloudflareCredentials', () => {
    it('returns both credentials when configured', () => {
        process.env.CLOUDFLARE_ZONE_ID = ZONE;
        process.env.CLOUDFLARE_API_TOKEN = TOKEN;

        expect(readCloudflareCredentials()).toEqual({ zoneId: ZONE, apiToken: TOKEN });
    });

    it.each([
        'CLOUDFLARE_ZONE_ID',
        'CLOUDFLARE_API_TOKEN'
    ])('returns null when %s is missing', (key) => {
        process.env.CLOUDFLARE_ZONE_ID = ZONE;
        process.env.CLOUDFLARE_API_TOKEN = TOKEN;
        delete process.env[key];

        expect(readCloudflareCredentials()).toBeNull();
    });

    it('treats an empty value as missing, not as a usable credential', () => {
        process.env.CLOUDFLARE_ZONE_ID = ZONE;
        process.env.CLOUDFLARE_API_TOKEN = '';

        expect(readCloudflareCredentials()).toBeNull();
    });
});

describe('purgeCloudflare', () => {
    it('sends the tag list and reports success', async () => {
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ success: true }), { status: 200 })
        );

        const outcome = await purgeCloudflare({
            zoneId: ZONE,
            apiToken: TOKEN,
            instruction: { kind: 'tags', tags: ['prod:all'] }
        });

        expect(outcome).toEqual({ ok: true });
        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(JSON.parse(String(init.body))).toEqual({ tags: ['prod:all'] });
    });

    it('sends purge_everything only for the explicit everything instruction', async () => {
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ success: true }), { status: 200 })
        );

        await purgeCloudflare({
            zoneId: ZONE,
            apiToken: TOKEN,
            instruction: { kind: 'everything' }
        });

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(JSON.parse(String(init.body))).toEqual({ purge_everything: true });
    });

    it('reports a non-2xx as an http failure, carrying the body', async () => {
        fetchMock.mockResolvedValue(new Response('rate limited', { status: 403 }));

        const outcome = await purgeCloudflare({
            zoneId: ZONE,
            apiToken: TOKEN,
            instruction: { kind: 'tags', tags: ['prod:all'] }
        });

        expect(outcome).toEqual({
            ok: false,
            kind: 'http',
            status: 403,
            detail: 'rate limited'
        });
    });

    it('treats a 200 with success:false as a failure, not a success', async () => {
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ success: false, errors: [{ code: 1234 }] }), {
                status: 200
            })
        );

        const outcome = await purgeCloudflare({
            zoneId: ZONE,
            apiToken: TOKEN,
            instruction: { kind: 'tags', tags: ['prod:all'] }
        });

        expect(outcome).toMatchObject({ ok: false, kind: 'rejected', status: 200 });
    });

    it('treats an unparseable 200 body as a failure', async () => {
        fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));

        const outcome = await purgeCloudflare({
            zoneId: ZONE,
            apiToken: TOKEN,
            instruction: { kind: 'tags', tags: ['prod:all'] }
        });

        expect(outcome).toMatchObject({ ok: false, kind: 'rejected' });
    });

    it('propagates a network error rather than swallowing it', async () => {
        // Preserves the pre-extraction behaviour of pages/api/revalidate.ts.
        fetchMock.mockRejectedValue(new Error('ECONNRESET'));

        await expect(
            purgeCloudflare({
                zoneId: ZONE,
                apiToken: TOKEN,
                instruction: { kind: 'tags', tags: ['prod:all'] }
            })
        ).rejects.toThrow('ECONNRESET');
    });
});
