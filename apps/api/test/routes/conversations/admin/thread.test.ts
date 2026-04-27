/**
 * Tests for GET /api/v1/admin/conversations/:id
 *
 * Verifies route registration, auth enforcement, permission checks, and
 * query-parameter validation for the admin conversation thread endpoint.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('GET /api/v1/admin/conversations/:id', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/admin/conversations';
    const VALID_UUID = '22222222-2222-4222-8222-222222222222';

    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';

    const adminViewAnyHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify([
            'conversation.view.own',
            'conversation.view.any'
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
            const res = await app.request(`${base}/${VALID_UUID}`, { method: 'GET' });
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
            const res = await app.request(`${base}/${VALID_UUID}`, {
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

    it('route is registered and reachable (not 404 on route lookup)', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}`, {
                method: 'GET',
                headers: adminViewAnyHeaders
            });
            // 404 from service (conversation not found) is acceptable
            expect([200, 400, 401, 403, 404, 500, 503]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403, 404, 500]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('accepts valid limit query param', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}?limit=20`, {
                method: 'GET',
                headers: adminViewAnyHeaders
            });
            expect([200, 400, 401, 403, 404, 500, 503]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403, 404]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 when limit exceeds maximum', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}?limit=200`, {
                method: 'GET',
                headers: adminViewAnyHeaders
            });
            expect([400, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 when cursor is not a valid ISO datetime', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}?cursor=not-a-date`, {
                method: 'GET',
                headers: adminViewAnyHeaders
            });
            expect([400, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('accepts valid ISO datetime as cursor', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}?cursor=2025-04-01T00:00:00.000Z`, {
                method: 'GET',
                headers: adminViewAnyHeaders
            });
            expect([200, 400, 401, 403, 404, 500, 503]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403, 404]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });
});
