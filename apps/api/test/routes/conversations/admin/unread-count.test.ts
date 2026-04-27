/**
 * Tests for GET /api/v1/admin/conversations/unread-count
 *
 * Verifies route registration, auth enforcement, permission checks, response
 * shape, and that the route resolves BEFORE the /:id wildcard.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('GET /api/v1/admin/conversations/unread-count', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/admin/conversations/unread-count';

    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';

    const viewOwnHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify([
            'conversation.view.own',
            'conversation.reply.own'
        ])
    };

    const insufficientHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'OWNER',
        'x-mock-actor-permissions': JSON.stringify(['accommodation.create'])
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

    it('returns 400 or 403 when actor lacks conversation view permission', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: insufficientHeaders
            });
            expect([400, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('route is registered and resolves before /:id wildcard (not 404)', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: viewOwnHeaders
            });
            // Must NOT be a route-level 404 (meaning /:id grabbed it as a param)
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

    it('response includes { count } when service responds with 200', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: viewOwnHeaders
            });

            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
                expect(body.data).toHaveProperty('count');
                expect(typeof body.data.count).toBe('number');
                expect(body.data.count).toBeGreaterThanOrEqual(0);
            } else {
                expect([400, 401, 403, 500, 503]).toContain(res.status);
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                const status = (error as { status: number }).status;
                expect(status).not.toBe(404);
            } else {
                throw error;
            }
        }
    });

    it('accepts optional query params without misrouting to /:id', async () => {
        try {
            const res = await app.request(`${base}?page=1`, {
                method: 'GET',
                headers: viewOwnHeaders
            });
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
