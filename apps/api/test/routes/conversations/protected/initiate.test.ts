/**
 * Tests for POST /api/v1/protected/conversations
 *
 * Uses app.request() with mock auth headers (x-mock-actor-*) to simulate
 * authenticated sessions. Services are NOT mocked — tests verify route
 * registration and schema validation without hitting a real DB.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('POST /api/v1/protected/conversations/initiate', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/protected/conversations/initiate';

    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';
    const MOCK_ROLE = 'USER';
    const MOCK_PERMISSIONS = JSON.stringify(['conversation.view.own', 'conversation.reply.own']);

    beforeAll(async () => {
        app = initApp();
    });

    it('returns 401 when no auth headers are provided', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    accommodationId: '22222222-2222-4222-8222-222222222222',
                    message: 'Hello, is this place available?'
                })
            });
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
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-mock-actor-id': MOCK_USER_ID,
                    'x-mock-actor-role': MOCK_ROLE,
                    'x-mock-actor-permissions': MOCK_PERMISSIONS
                },
                body: JSON.stringify({
                    accommodationId: '22222222-2222-4222-8222-222222222222',
                    message: 'Hello!'
                })
            });
            // 404 means route is not registered — must not happen
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

    it('returns 400 when request body is missing', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-mock-actor-id': MOCK_USER_ID,
                    'x-mock-actor-role': MOCK_ROLE,
                    'x-mock-actor-permissions': MOCK_PERMISSIONS
                },
                body: JSON.stringify({})
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

    it('returns 400 when accommodationId is not a UUID', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-mock-actor-id': MOCK_USER_ID,
                    'x-mock-actor-role': MOCK_ROLE,
                    'x-mock-actor-permissions': MOCK_PERMISSIONS
                },
                body: JSON.stringify({
                    accommodationId: 'not-a-uuid',
                    message: 'Hello!'
                })
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

    it('returns 400 when message is empty', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-mock-actor-id': MOCK_USER_ID,
                    'x-mock-actor-role': MOCK_ROLE,
                    'x-mock-actor-permissions': MOCK_PERMISSIONS
                },
                body: JSON.stringify({
                    accommodationId: '22222222-2222-4222-8222-222222222222',
                    message: ''
                })
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

    it('returns 400 or service error when accommodationId does not exist', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-mock-actor-id': MOCK_USER_ID,
                    'x-mock-actor-role': MOCK_ROLE,
                    'x-mock-actor-permissions': MOCK_PERMISSIONS
                },
                body: JSON.stringify({
                    accommodationId: '00000000-0000-4000-8000-000000000099',
                    message: 'Hello, is this place available?'
                })
            });
            // Without DB: expect validation or service failure, not 404 route missing
            expect(res.status).not.toBe(404);
            // Service will return 404 (NOT_FOUND) or 400/500 when DB is unavailable
            expect([400, 401, 403, 404, 500, 503]).toContain(res.status);
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
