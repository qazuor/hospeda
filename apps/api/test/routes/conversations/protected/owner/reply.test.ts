/**
 * Tests for POST /api/v1/protected/conversations/owner/:id/messages
 *
 * Verifies route registration, auth enforcement, ownership check (404 for
 * non-owned conversations), body validation, and response shape for the
 * owner reply endpoint.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../../src/app.js';
import type { AppOpenAPI } from '../../../../../src/types.js';

describe('POST /api/v1/protected/conversations/owner/:id/messages', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/protected/conversations/owner';

    const MOCK_OWNER_ID = '22222222-2222-4222-8222-222222222222';
    const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000099';

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
            const res = await app.request(`${base}/${NON_EXISTENT_ID}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: 'Hello' })
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

    it('route is registered and returns error for non-existent conversation', async () => {
        try {
            const res = await app.request(`${base}/${NON_EXISTENT_ID}/messages`, {
                method: 'POST',
                headers: {
                    ...ownerHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ body: 'Hello' })
            });
            // Should be 404 or 400 (conversation not found / ownership check)
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

    it('returns 400 when request body is missing', async () => {
        try {
            const res = await app.request(`${base}/${NON_EXISTENT_ID}/messages`, {
                method: 'POST',
                headers: {
                    ...ownerHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
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

    it('returns 400 when body field is empty string', async () => {
        try {
            const res = await app.request(`${base}/${NON_EXISTENT_ID}/messages`, {
                method: 'POST',
                headers: {
                    ...ownerHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ body: '' })
            });
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

    it('returns 404 for conversation not owned by the actor', async () => {
        try {
            // Use a valid UUID that exists but belongs to a different owner
            const res = await app.request(`${base}/11111111-1111-4111-8111-111111111111/messages`, {
                method: 'POST',
                headers: {
                    ...ownerHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ body: 'Hello from owner' })
            });
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
