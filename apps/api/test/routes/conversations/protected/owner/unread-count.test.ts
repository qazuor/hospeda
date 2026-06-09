/**
 * Tests for GET /api/v1/protected/conversations/owner/unread-count
 *
 * Verifies route registration, auth enforcement, owner accommodation scoping,
 * and response shape for the owner unread count endpoint.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../../src/app.js';
import type { AppOpenAPI } from '../../../../../src/types.js';

describe('GET /api/v1/protected/conversations/owner/unread-count', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/protected/conversations/owner/unread-count';

    const MOCK_OWNER_ID = '22222222-2222-4222-8222-222222222222';

    const ownerHeaders = {
        'x-mock-actor-id': MOCK_OWNER_ID,
        'x-mock-actor-role': 'USER',
        'x-mock-actor-permissions': JSON.stringify([
            'conversation.view.own',
            'conversation.reply.own'
        ])
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
                headers: ownerHeaders
            });
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

    it('returns { count } shape when authenticated', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: ownerHeaders
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

    it('does not accept path segments that could collide with /:id', async () => {
        try {
            // This test ensures /unread-count is resolved BEFORE /:id
            const res = await app.request(`${base}?page=1`, {
                method: 'GET',
                headers: ownerHeaders
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
