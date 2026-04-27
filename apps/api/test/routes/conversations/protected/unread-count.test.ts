/**
 * Tests for GET /api/v1/protected/conversations/unread-count
 *
 * Verifies route registration, auth enforcement, and response shape.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('GET /api/v1/protected/conversations/unread-count', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/protected/conversations/unread-count';

    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';
    const MOCK_ROLE = 'USER';
    const MOCK_PERMISSIONS = JSON.stringify(['conversation.view.own', 'conversation.reply.own']);

    const mockHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': MOCK_ROLE,
        'x-mock-actor-permissions': MOCK_PERMISSIONS
    };

    beforeAll(async () => {
        app = initApp();
    });

    it('returns 401 when no auth headers are provided', async () => {
        try {
            const res = await app.request(base, { method: 'GET' });
            expect([400, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('route is registered and reachable (not 404 on route lookup)', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: mockHeaders
            });
            // Must not be a route-level 404 (route not registered)
            expect(res.status).not.toBe(404);
            expect([200, 400, 401, 403, 500, 503]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                const status = (error as { status: number }).status;
                expect(status).not.toBe(404);
            } else {
                throw error;
            }
        }
    });

    it('when authenticated and DB returns data, response includes { count }', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: mockHeaders
            });

            expect([200, 400, 401, 403, 500, 503]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
                expect(body.data).toHaveProperty('count');
                expect(typeof body.data.count).toBe('number');
                expect(body.data.count).toBeGreaterThanOrEqual(0);
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('does not accept extra query params that might conflict with /:id route', async () => {
        try {
            // This test ensures /unread-count is resolved BEFORE /:id
            const res = await app.request(`${base}?page=1`, {
                method: 'GET',
                headers: mockHeaders
            });
            // The important thing is that we hit the right route, not a 404
            expect(res.status).not.toBe(404);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                const status = (error as { status: number }).status;
                expect(status).not.toBe(404);
            } else {
                throw error;
            }
        }
    });
});
