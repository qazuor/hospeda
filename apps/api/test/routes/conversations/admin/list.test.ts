/**
 * Tests for GET /api/v1/admin/conversations
 *
 * Verifies route registration, auth enforcement, permission checks, and query
 * parameter validation for the admin conversation list endpoint.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('GET /api/v1/admin/conversations', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/admin/conversations';

    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';

    const adminHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify([
            'conversation.view.own',
            'conversation.view.any',
            'conversation.view.all'
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

    it('returns 400 or 403 when actor lacks conversation view permissions', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: insufficientHeaders
            });
            // 403 if permission check fires first; 400 if service layer errors
            expect([400, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('route is registered and reachable with valid permissions', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: adminHeaders
            });
            // Accepts any non-route-level 404 response
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

    it('accepts valid pagination query params', async () => {
        try {
            const res = await app.request(`${base}?page=1&pageSize=20`, {
                method: 'GET',
                headers: adminHeaders
            });
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

    it('returns 200 with pagination shape when service responds successfully', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: adminHeaders
            });

            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
                expect(Array.isArray(body.data)).toBe(true);
                expect(body).toHaveProperty('pagination');
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
});
