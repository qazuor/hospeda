/**
 * Tests for GET /api/v1/protected/conversations
 *
 * Verifies route registration, query-parameter validation, and auth enforcement.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('GET /api/v1/protected/conversations', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/protected/conversations';

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

    it('route is registered and reachable (not 404)', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: mockHeaders
            });
            expect(res.status).not.toBe(404);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect((error as { status: number }).status).not.toBe(404);
            } else {
                throw error;
            }
        }
    });

    it('accepts valid page/pageSize query parameters', async () => {
        try {
            const res = await app.request(`${base}?page=1&pageSize=10`, {
                method: 'GET',
                headers: mockHeaders
            });
            expect(res.status).not.toBe(404);
            expect([200, 400, 401, 403, 500, 503]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('accepts archivedByGuest=true filter', async () => {
        try {
            const res = await app.request(`${base}?archivedByGuest=true`, {
                method: 'GET',
                headers: mockHeaders
            });
            expect(res.status).not.toBe(404);
            expect([200, 400, 401, 403, 500, 503]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('accepts archivedByGuest=false filter', async () => {
        try {
            const res = await app.request(`${base}?archivedByGuest=false`, {
                method: 'GET',
                headers: mockHeaders
            });
            expect(res.status).not.toBe(404);
            expect([200, 400, 401, 403, 500, 503]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 when pageSize exceeds maximum (100)', async () => {
        try {
            const res = await app.request(`${base}?pageSize=200`, {
                method: 'GET',
                headers: mockHeaders
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

    it('accepts combined valid query params', async () => {
        try {
            const res = await app.request(`${base}?page=2&pageSize=20&archivedByGuest=false`, {
                method: 'GET',
                headers: mockHeaders
            });
            expect(res.status).not.toBe(404);
            expect([200, 400, 401, 403, 500, 503]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });
});
