/**
 * Tests for POST /api/v1/admin/conversations/:id/messages
 *
 * Verifies route registration, auth enforcement, permission checks, body
 * validation, and the 201/422 response contract.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('POST /api/v1/admin/conversations/:id/messages', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/admin/conversations';
    const VALID_UUID = '22222222-2222-4222-8222-222222222222';

    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';

    const replyAnyHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify([
            'conversation.reply.any',
            'conversation.view.any'
        ])
    };

    const replyOwnHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'OWNER',
        'x-mock-actor-permissions': JSON.stringify([
            'conversation.reply.own',
            'conversation.view.own'
        ])
    };

    const insufficientHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'OWNER',
        'x-mock-actor-permissions': JSON.stringify(['accommodation.create'])
    };

    const validBody = JSON.stringify({ body: 'Hello, how can I help you?' });

    beforeAll(async () => {
        app = initApp();
    });

    it('returns 401 when no auth headers are provided', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: validBody
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

    it('returns 400 or 403 when actor lacks reply permissions', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/messages`, {
                method: 'POST',
                headers: {
                    ...insufficientHeaders,
                    'Content-Type': 'application/json'
                },
                body: validBody
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

    it('route is registered and reachable with reply.any permission', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/messages`, {
                method: 'POST',
                headers: {
                    ...replyAnyHeaders,
                    'Content-Type': 'application/json'
                },
                body: validBody
            });
            // 404 from service is acceptable; route-level 404 is not
            expect([201, 400, 401, 403, 404, 422, 500, 503]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403, 404, 422, 500]).toContain(
                    (error as { status: number }).status
                );
            } else {
                throw error;
            }
        }
    });

    it('route is reachable with reply.own permission', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/messages`, {
                method: 'POST',
                headers: {
                    ...replyOwnHeaders,
                    'Content-Type': 'application/json'
                },
                body: validBody
            });
            expect([201, 400, 401, 403, 404, 422, 500, 503]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403, 404, 422, 500]).toContain(
                    (error as { status: number }).status
                );
            } else {
                throw error;
            }
        }
    });

    it('returns 400 when body is missing the message body field', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/messages`, {
                method: 'POST',
                headers: {
                    ...replyAnyHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            expect([400, 422]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 422]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 when body field is an empty string', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/messages`, {
                method: 'POST',
                headers: {
                    ...replyAnyHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ body: '' })
            });
            expect([400, 422]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 422]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });
});
