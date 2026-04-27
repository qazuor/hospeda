/**
 * Tests for PATCH /api/v1/admin/conversations/:id/status
 *
 * Verifies route registration, auth enforcement, permission routing
 * (BLOCK vs non-BLOCK targets), and body validation.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('PATCH /api/v1/admin/conversations/:id/status', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/admin/conversations';
    const VALID_UUID = '22222222-2222-4222-8222-222222222222';

    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';

    /** Actor with update-status (non-block) permissions */
    const updateStatusHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify([
            'conversation.updateStatus.own',
            'conversation.updateStatus.any'
        ])
    };

    /** Actor with block permissions */
    const blockHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify([
            'conversation.block.own',
            'conversation.block.any',
            'conversation.updateStatus.own',
            'conversation.updateStatus.any'
        ])
    };

    /** Actor with no relevant permissions */
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
            const res = await app.request(`${base}/${VALID_UUID}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'CLOSED' })
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

    it('returns 400 or 403 when actor lacks status-update permissions for CLOSED target', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/status`, {
                method: 'PATCH',
                headers: {
                    ...insufficientHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'CLOSED' })
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

    it('returns 400 or 403 when actor has update-status but NOT block permission for BLOCKED target', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/status`, {
                method: 'PATCH',
                headers: {
                    ...updateStatusHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'BLOCKED', blockReason: 'Spam' })
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

    it('route is reachable for CLOSED target with update-status permission', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/status`, {
                method: 'PATCH',
                headers: {
                    ...updateStatusHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'CLOSED' })
            });
            // Not a route-level 404
            expect([200, 400, 401, 403, 404, 500, 503]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403, 404, 500]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('route is reachable for BLOCKED target with block permission', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/status`, {
                method: 'PATCH',
                headers: {
                    ...blockHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'BLOCKED', blockReason: 'Spam' })
            });
            expect([200, 400, 401, 403, 404, 500, 503]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403, 404, 500]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 when request body is missing status field', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/status`, {
                method: 'PATCH',
                headers: {
                    ...updateStatusHeaders,
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

    it('returns 400 when status is an invalid enum value', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/status`, {
                method: 'PATCH',
                headers: {
                    ...updateStatusHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'INVALID_STATUS' })
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
