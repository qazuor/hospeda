/**
 * Rate-limit integration test for the import route (SPEC-222 T-021).
 *
 * Isolated in its own file because it must ENABLE rate limiting at env-load
 * time (`HOSPEDA_TESTING_RATE_LIMIT`), which is globally OFF in the shared test
 * setup. `vi.hoisted` sets the env vars before any import runs, and the per-user
 * cap is pinned to 1/hour so the second request from the same actor trips the
 * sliding window and returns 429 + Retry-After.
 *
 * The network is mocked (blocked fetch) so the first request completes via the
 * degrade path without touching the AI provider or a real site.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
    process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';
    process.env.HOSPEDA_IMPORT_RATE_LIMIT_RPH = '1';
});

vi.mock('@repo/utils/safe-fetch', async (importActual) => {
    const actual = await importActual<typeof import('@repo/utils/safe-fetch')>();
    return {
        ...actual,
        safeExternalFetch: vi.fn(async () => ({
            ok: false as const,
            status: 0 as const,
            error: 'Blocked by SSRF policy',
            blocked: true as const
        }))
    };
});

import { PermissionEnum } from '@repo/schemas';
import { initApp } from '../../../../src/app.js';
import { clearSlidingWindowStore } from '../../../../src/middlewares/rate-limit';
import type { AppOpenAPI } from '../../../../src/types.js';

const ENDPOINT = '/api/v1/protected/accommodations/import-from-url';

function authHeaders(actorId: string): Record<string, string> {
    return {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': actorId,
        'x-mock-actor-role': 'HOST',
        'x-mock-actor-permissions': JSON.stringify([PermissionEnum.ACCOMMODATION_CREATE])
    };
}

function importRequest(app: AppOpenAPI, actorId: string) {
    return app.request(ENDPOINT, {
        method: 'POST',
        headers: authHeaders(actorId),
        body: JSON.stringify({ url: 'https://example.com/listing/1', legalConfirmed: true })
    });
}

describe('import-from-url rate limit', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        clearSlidingWindowStore();
        app = initApp();
    });

    it('allows the first request and returns 429 + Retry-After on the second (same user)', async () => {
        const actorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

        // First request passes the per-user window (cap = 1/hour).
        const first = await importRequest(app, actorId);
        expect(first.status).toBe(200);

        // Second request from the same user trips the window.
        const second = await importRequest(app, actorId);
        expect(second.status).toBe(429);
        expect(Number(second.headers.get('Retry-After'))).toBeGreaterThan(0);
        const body = (await second.json()) as { success: boolean; error: { code: string } };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
});
