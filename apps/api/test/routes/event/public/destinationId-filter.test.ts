/**
 * Integration tests for event list endpoint — destinationId filter behavior.
 *
 * KNOWN GAP: The `destinationId` field exists in `EventSearchSchema` (domain layer)
 * but is NOT in `EventSearchHttpSchema` (HTTP layer). Zod strips unknown fields by
 * default, so `?destinationId=UUID` is silently discarded before reaching the service.
 *
 * These tests document current behavior. Once `destinationId` is added to
 * `EventSearchHttpSchema`, the filter tests should be updated to verify actual filtering.
 *
 * @see packages/schemas/src/entities/event/event.query.schema.ts — domain schema (has destinationId)
 * @see packages/schemas/src/entities/event/event.http.schema.ts — HTTP schema (missing destinationId)
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/events';
const VALID_UUID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('GET /api/v1/public/events — destinationId filter', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    // -----------------------------------------------------------------------
    // Route registration
    // -----------------------------------------------------------------------

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await app.request(BASE, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(404);
        });
    });

    // -----------------------------------------------------------------------
    // Public access
    // -----------------------------------------------------------------------

    describe('Public Access', () => {
        it('should not require authentication', async () => {
            const res = await app.request(BASE, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });

    // -----------------------------------------------------------------------
    // Response shape
    // -----------------------------------------------------------------------

    describe('Response Shape', () => {
        it('should return JSON with success field', async () => {
            const res = await app.request(BASE, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            const body = await res.json();
            expect(body).toHaveProperty('success');
        });
    });

    // -----------------------------------------------------------------------
    // destinationId filter behavior (currently stripped by Zod)
    // -----------------------------------------------------------------------

    describe('destinationId Query Param', () => {
        it('should reject ?destinationId=UUID with 400 (not in HTTP schema)', async () => {
            // CONFIRMED: The EventSearchHttpSchema does NOT include destinationId.
            // Unlike some endpoints that use .strip(), the event route validates strictly,
            // rejecting unknown query parameters with 400.
            // TODO: Once destinationId is added to EventSearchHttpSchema, this test should
            // be updated to expect 200 instead.
            const res = await app.request(`${BASE}?destinationId=${VALID_UUID}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(400);
        });

        it('should handle base request differently than one with unknown params', async () => {
            const [withFilter, without] = await Promise.all([
                app.request(`${BASE}?destinationId=${VALID_UUID}`, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                }),
                app.request(BASE, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                })
            ]);

            // destinationId causes 400 (rejected), base request gets through (200 or 500)
            expect(withFilter.status).toBe(400);
            expect(without.status).not.toBe(400);
        });
    });

    // -----------------------------------------------------------------------
    // Method restrictions
    // -----------------------------------------------------------------------

    describe('HTTP Method Restrictions', () => {
        it('should reject POST requests', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([404, 405]).toContain(res.status);
        });
    });
});
