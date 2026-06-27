/**
 * Route test for GET /api/v1/public/destinations/:id/weather (SPEC-215).
 *
 * Route-level tests mock the service layer (see test/setup.ts). The real
 * WeatherService runs against the mocked DestinationService, whose stub
 * destination carries no `weatherCurrent`, so the endpoint returns the neutral
 * `null` (uncached) payload. The cached / not-found branches are covered by the
 * WeatherService unit tests (weather.service.test.ts).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('GET /api/v1/public/destinations/:id/weather', () => {
    let app: AppOpenAPI;
    const DEST_ID = '44444444-4444-4444-8444-444444444444';
    const path = `/api/v1/public/destinations/${DEST_ID}/weather`;

    const headers = { Accept: 'application/json', 'user-agent': 'vitest' };

    beforeAll(async () => {
        app = await initApp();
    });

    it('is registered and responds without auth (public tier)', async () => {
        const res = await app.request(path, { method: 'GET', headers });
        // Registered route: not a 404 route-miss; public: not 401.
        expect(res.status).not.toBe(404);
        expect(res.status).not.toBe(401);
        expect(res.status).toBe(200);
    });

    it('returns the neutral (null) payload when no weather is cached', async () => {
        const res = await app.request(path, { method: 'GET', headers });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { success: boolean; data: unknown };
        expect(body.success).toBe(true);
        expect(body.data).toBeNull();
    });
});
