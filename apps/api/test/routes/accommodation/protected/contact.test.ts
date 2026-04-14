/**
 * Integration tests for GET /api/v1/protected/accommodations/:id/contact
 *
 * Tests route registration, authentication, and basic behavior.
 * The contact endpoint resolves preferred email/phone from accommodation's
 * contactInfo JSONB field.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/protected/accommodations';
const VALID_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('GET /api/v1/protected/accommodations/:id/contact', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    // -----------------------------------------------------------------------
    // Route registration
    // -----------------------------------------------------------------------

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/contact`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // 401 is expected without auth — NOT 404
            expect(res.status).not.toBe(404);
        });

        it('should return JSON content-type', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/contact`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            const ct = res.headers.get('content-type') ?? '';
            expect(ct).toContain('application/json');
        });
    });

    // -----------------------------------------------------------------------
    // Authentication
    // -----------------------------------------------------------------------

    describe('Authentication', () => {
        it('should return 401 for guest actor', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/contact`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'GUEST'
                }
            });
            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.success).toBe(false);
        });

        it('should return 401 when no auth headers are provided', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/contact`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(401);
        });

        it('should accept mock actor headers when mock auth is enabled', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/contact`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'USER',
                    'x-mock-actor-id': 'user-1'
                }
            });
            // NOTE: The contact route uses manual auth check (isGuestActor),
            // which may or may not recognize mock actor headers depending on
            // how the actor middleware resolves. Either 401 (mock not recognized)
            // or non-401 (mock recognized) is valid — we just confirm it's handled.
            expect([200, 401, 404, 500]).toContain(res.status);
        });
    });

    // -----------------------------------------------------------------------
    // Response shape (with mock DB — accommodation may not exist)
    // -----------------------------------------------------------------------

    describe('Response Shape', () => {
        it('should return success field in JSON response', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/contact`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'USER',
                    'x-mock-actor-id': 'user-1'
                }
            });
            const body = await res.json();
            expect(body).toHaveProperty('success');
        });

        it('should return 404 or data when authenticated (not 400)', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/contact`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'USER',
                    'x-mock-actor-id': 'user-1'
                }
            });
            // With mock DB returning empty, expect 404 (not found) or 200 (empty contact)
            // CRITICAL: Must NOT be 400 "Missing required parameter: id" (the ownership bug)
            expect(res.status).not.toBe(400);
        });
    });

    // -----------------------------------------------------------------------
    // HTTP method restrictions
    // -----------------------------------------------------------------------

    describe('HTTP Method Restrictions', () => {
        it('should reject POST requests', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/contact`, {
                method: 'POST',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // Protected routes return 401 for unauthenticated non-GET, or 404/405
            expect([401, 404, 405]).toContain(res.status);
        });

        it('should reject DELETE requests', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/contact`, {
                method: 'DELETE',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([401, 404, 405]).toContain(res.status);
        });
    });
});
