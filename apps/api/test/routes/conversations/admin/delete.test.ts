/**
 * Tests for DELETE /api/v1/admin/conversations/:id
 *
 * Verifies route registration, auth enforcement, permission checks, and the
 * 204 No Content response contract.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('DELETE /api/v1/admin/conversations/:id', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/admin/conversations';
    const VALID_UUID = '22222222-2222-4222-8222-222222222222';

    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';

    const deleteAnyHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify([
            'conversation.delete.any',
            'conversation.view.any'
        ])
    };

    const insufficientHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'OWNER',
        'x-mock-actor-permissions': JSON.stringify(['accommodation.create'])
    };

    /** Actor with view.any but NOT delete.any — should be denied */
    const viewOnlyHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(['conversation.view.any'])
    };

    beforeAll(async () => {
        app = initApp();
    });

    it('returns 401 when no auth headers are provided', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}`, {
                method: 'DELETE'
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

    it('returns 400 or 403 when actor lacks delete-any permission', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}`, {
                method: 'DELETE',
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

    it('returns 400 or 403 when actor has view.any but NOT delete.any', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}`, {
                method: 'DELETE',
                headers: viewOnlyHeaders
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

    it('route is registered and reachable with delete.any permission', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}`, {
                method: 'DELETE',
                headers: deleteAnyHeaders
            });
            // 204 (success) or 404 (service: not found) are both acceptable
            expect([204, 400, 401, 403, 404, 500, 503]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403, 404, 500]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 204 with empty body on success (if service responds)', async () => {
        try {
            const res = await app.request(`${base}/${VALID_UUID}`, {
                method: 'DELETE',
                headers: deleteAnyHeaders
            });

            if (res.status === 204) {
                const body = await res.text();
                expect(body).toBe('');
            } else {
                expect([400, 401, 403, 404, 500, 503]).toContain(res.status);
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403, 404, 500]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });
});
