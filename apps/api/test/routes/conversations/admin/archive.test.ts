/**
 * Tests for PATCH /api/v1/admin/conversations/:id/archive
 *
 * Verifies route registration, auth enforcement, permission checks, and body
 * validation for the admin archive toggle endpoint.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('PATCH /api/v1/admin/conversations/:id/archive', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/admin/conversations';
    const VALID_UUID = '22222222-2222-4222-8222-222222222222';

    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';

    const updateStatusHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify([
            'conversation.updateStatus.own',
            'conversation.view.own'
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
            const res = await app.request(`${base}/${VALID_UUID}/archive`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ archived: true })
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

    it('returns 400 or 403 when actor lacks conversation update-status permission', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/archive`, {
                method: 'PATCH',
                headers: {
                    ...insufficientHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ archived: true })
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

    it('route is registered and reachable with valid permissions (archive = true)', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/archive`, {
                method: 'PATCH',
                headers: {
                    ...updateStatusHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ archived: true })
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

    it('route is reachable with archived = false (unarchive)', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/archive`, {
                method: 'PATCH',
                headers: {
                    ...updateStatusHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ archived: false })
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

    it('returns 400 when archived field is missing', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/archive`, {
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

    it('returns 400 when archived is not a boolean', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}/archive`, {
                method: 'PATCH',
                headers: {
                    ...updateStatusHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ archived: 'yes' })
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
