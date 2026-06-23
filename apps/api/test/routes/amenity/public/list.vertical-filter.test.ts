/**
 * Integration tests for the `?applicableVertical=` filter on
 * GET /api/v1/public/amenities (SPEC-266 T-005).
 *
 * These tests verify the HTTP-layer contract only:
 *  1. No filter → route accepts the request (no validation error).
 *  2. Valid vertical value → route accepts the request (no validation error).
 *  3. Invalid vertical value → 400 (Zod enum rejection).
 *
 * Full DB-level filtering assertions (that only gastronomy-applicable amenities
 * are returned) require a seeded test database and belong in an e2e suite.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/amenities';

describe('GET /api/v1/public/amenities — ?applicableVertical filter (SPEC-266 T-005)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it('(1) no filter — accepts request without validation error', async () => {
        const res = await app.request(BASE, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        // Route exists; may return 200 (items) or 500 (no DB in unit mode).
        // Must NOT return 400 (validation error) or 404 (unknown route).
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(404);
    });

    it('(2) ?applicableVertical=accommodation — accepted, not a validation error', async () => {
        const res = await app.request(`${BASE}?applicableVertical=accommodation`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(404);
    });

    it('(2) ?applicableVertical=gastronomy — accepted, not a validation error', async () => {
        const res = await app.request(`${BASE}?applicableVertical=gastronomy`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(404);
    });

    it('(2) ?applicableVertical=experience — accepted, not a validation error', async () => {
        const res = await app.request(`${BASE}?applicableVertical=experience`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(404);
    });

    it('(3) ?applicableVertical=invalid — rejected by Zod enum with 400', async () => {
        const res = await app.request(`${BASE}?applicableVertical=invalid`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(400);
    });

    it('(3) ?applicableVertical=ACCOMMODATION — rejected (case-sensitive enum)', async () => {
        const res = await app.request(`${BASE}?applicableVertical=ACCOMMODATION`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(400);
    });
});
