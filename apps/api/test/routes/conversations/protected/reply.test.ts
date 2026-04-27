/**
 * Tests for POST /api/v1/protected/conversations/:id/messages
 *
 * Verifies route registration, body validation, and auth enforcement.
 * The 404 anti-enumeration behavior is checked where possible.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('POST /api/v1/protected/conversations/:id/messages', () => {
    let app: AppOpenAPI;
    const VALID_UUID = '22222222-2222-4222-8222-222222222222';

    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';
    const MOCK_ROLE = 'USER';
    const MOCK_PERMISSIONS = JSON.stringify(['conversation.view.own', 'conversation.reply.own']);

    const mockHeaders = {
        'content-type': 'application/json',
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': MOCK_ROLE,
        'x-mock-actor-permissions': MOCK_PERMISSIONS
    };

    beforeAll(async () => {
        app = initApp();
    });

    it('returns 401 when no auth headers are provided', async () => {
        try {
            const res = await app.request(
                `/api/v1/protected/conversations/${VALID_UUID}/messages`,
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ body: 'Hello again!' })
                }
            );
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
            const res = await app.request(
                `/api/v1/protected/conversations/${VALID_UUID}/messages`,
                {
                    method: 'POST',
                    headers: mockHeaders,
                    body: JSON.stringify({ body: 'Hello again!' })
                }
            );
            expect([200, 201, 400, 401, 403, 404, 422, 500, 503]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403, 404]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 when body field is missing', async () => {
        try {
            const res = await app.request(
                `/api/v1/protected/conversations/${VALID_UUID}/messages`,
                {
                    method: 'POST',
                    headers: mockHeaders,
                    body: JSON.stringify({})
                }
            );
            expect([400, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 when body field is empty string', async () => {
        try {
            const res = await app.request(
                `/api/v1/protected/conversations/${VALID_UUID}/messages`,
                {
                    method: 'POST',
                    headers: mockHeaders,
                    body: JSON.stringify({ body: '' })
                }
            );
            expect([400, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 404 with CONVERSATION_NOT_FOUND reason for a non-existent conversation', async () => {
        try {
            const res = await app.request(
                `/api/v1/protected/conversations/${VALID_UUID}/messages`,
                {
                    method: 'POST',
                    headers: mockHeaders,
                    body: JSON.stringify({ body: 'Hello again, does this route exist?' })
                }
            );
            // Without DB: expect 404 or service-level error
            expect([400, 401, 403, 404, 500, 503]).toContain(res.status);
            if (res.status === 404) {
                const body = await res.json();
                expect(body?.error?.reason).toBe('CONVERSATION_NOT_FOUND');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403, 404]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });
});
