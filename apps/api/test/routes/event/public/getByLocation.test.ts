/**
 * Regression tests for `GET /api/v1/public/events/location/{locationId}`.
 *
 * The bug: the handler returned `EventService.getByLocation`'s output
 * directly. That output is the model's `{ items, total }`, but
 * `createPublicListRoute` requires `{ items, pagination }` and throws
 * "Paginated result must have items and pagination properties" otherwise —
 * so this endpoint answered **500 for every location**, from the day it
 * shipped. A `return result.data as never` cast kept the compiler from
 * seeing the mismatch.
 *
 * It went unnoticed because the shared `EventService` test mock used to
 * return a `pagination` envelope the real service never produces. Both
 * halves are fixed: the route now builds the envelope, and the mock now
 * returns the real shape so this test can actually fail if the route stops
 * doing it.
 *
 * @see apps/api/src/routes/event/public/getByLocation.ts
 * @see packages/service-core/src/services/event/event.service.ts — returns `model.findAll`
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/events/location';
const VALID_UUID = 'e5e5e5e5-e5e5-4e5e-ae5e-e5e5e5e5e5e5';

const request = (app: AppOpenAPI, path: string) =>
    app.request(path, {
        method: 'GET',
        headers: { 'user-agent': 'vitest', accept: 'application/json' }
    });

describe('GET /api/v1/public/events/location/{locationId}', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it('is registered and reachable', async () => {
        const res = await request(app, `${BASE}/${VALID_UUID}`);
        expect(res.status).not.toBe(404);
    });

    it('does NOT answer 500 — the regression', async () => {
        // The single assertion that would have caught the shipped bug.
        const res = await request(app, `${BASE}/${VALID_UUID}`);
        expect(res.status).toBe(200);
    });

    it('wraps the service output in a pagination envelope', async () => {
        // The service returns `{ items, total }`; building `pagination` is the
        // route's job, and the list factory rejects the response without it.
        const res = await request(app, `${BASE}/${VALID_UUID}`);
        const body = await res.json();

        expect(body.success).toBe(true);
        expect(Array.isArray(body.data.items)).toBe(true);
        expect(body.data.pagination).toMatchObject({
            page: expect.any(Number),
            pageSize: expect.any(Number),
            total: expect.any(Number),
            totalPages: expect.any(Number)
        });
    });

    it('echoes the requested page and pageSize', async () => {
        // Non-vacuity guard for the envelope above: it must describe the
        // request, not carry hardcoded defaults.
        const res = await request(app, `${BASE}/${VALID_UUID}?page=3&pageSize=7`);
        const body = await res.json();

        expect(body.data.pagination.page).toBe(3);
        expect(body.data.pagination.pageSize).toBe(7);
    });

    it('does not require authentication', async () => {
        // It backs a public location page; a 401/403 here would leave the
        // events block permanently empty for anonymous visitors.
        const res = await request(app, `${BASE}/${VALID_UUID}`);
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
    });

    it('rejects a locationId that is not a UUID', async () => {
        const res = await request(app, `${BASE}/not-a-uuid`);
        expect(res.status).toBe(400);
    });
});
