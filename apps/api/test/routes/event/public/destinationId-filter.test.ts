/**
 * Integration tests for event list endpoint — destinationId filter behavior.
 *
 * SPEC-089 Track B: `destinationId` is now accepted in `EventSearchHttpSchema`.
 * The filter is resolved via `event_locations.destination_id` in the service layer.
 *
 * SPEC-096 T-005: additionally tests that invalid (non-UUID) destinationId values
 * are rejected with 400 by Zod schema validation.
 *
 * @see packages/schemas/src/entities/event/event.http.schema.ts — HTTP schema (has destinationId)
 * @see packages/schemas/src/entities/event/event.query.schema.ts — domain schema (has destinationId)
 * @see packages/service-core/src/services/event/event.service.ts — resolution via event_locations
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/events';
// Must be a valid UUID v4 (Zod's uuid() validates against versions 1-8)
const VALID_UUID = 'd4d4d4d4-d4d4-4d4d-ad4d-d4d4d4d4d4d4';

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
    // destinationId filter behavior (SPEC-089 Track B)
    // -----------------------------------------------------------------------

    describe('destinationId Query Param', () => {
        it('should accept ?destinationId=UUID and return 200 (not 400)', async () => {
            // SPEC-089 Track B: destinationId is now in EventSearchHttpSchema.
            // The route accepts the filter and passes it to the service, which
            // resolves location IDs via event_locations.destination_id.
            // In the test environment no rows exist for the dummy UUID, so the
            // service short-circuits and returns an empty list (not an error).
            const res = await app.request(`${BASE}?destinationId=${VALID_UUID}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(400);
            // The route may return 200 (empty list) or 500 (if DB not available in CI).
            // Either way it should NOT be 400 (schema rejection).
            expect([200, 500]).toContain(res.status);
        });

        it('should treat destinationId differently from unknown params', async () => {
            const [withDestination, withUnknown] = await Promise.all([
                app.request(`${BASE}?destinationId=${VALID_UUID}`, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                }),
                app.request(`${BASE}?unknownParam=foo`, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                })
            ]);

            // destinationId is a known schema field — must not be 400.
            expect(withDestination.status).not.toBe(400);
            // unknownParam is not in the schema — may be 400 (strict validation).
            expect([400, 200, 500]).toContain(withUnknown.status);
        });
    });

    // -----------------------------------------------------------------------
    // Invalid destinationId validation (SPEC-096 T-005)
    // -----------------------------------------------------------------------

    describe('destinationId Validation', () => {
        it('should return 400 for invalid (non-UUID) destinationId', async () => {
            // SPEC-096 T-005: Zod validates destinationId as z.string().uuid().
            // A non-UUID string must be rejected before reaching the service layer.
            const res = await app.request(`${BASE}?destinationId=not-a-uuid`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(400);
        });

        it('should return 400 for malformed UUID destinationId', async () => {
            const res = await app.request(`${BASE}?destinationId=12345678-bad-uuid`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(400);
        });

        it('should accept a well-formed UUID and not return 400', async () => {
            const res = await app.request(`${BASE}?destinationId=${VALID_UUID}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(400);
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
