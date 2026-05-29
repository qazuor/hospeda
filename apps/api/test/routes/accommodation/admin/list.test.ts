/**
 * Tests for GET /api/v1/admin/accommodations (SPEC-169 T-008).
 *
 * Verifies the route's MIDDLEWARE permission gate after SPEC-169: the route no longer declares
 * ACCOMMODATION_VIEW_ALL (which, via hasAllPermissions, would force AND-semantics and 403 a
 * legitimate VIEW_OWN host at the middleware). The gate now only requires admin access; the
 * entity-specific permission (VIEW_ALL OR VIEW_OWN) and owner-scoping live in the service.
 *
 * NOTE: in route-level tests the service layer is MOCKED (see test/setup.ts), so the real
 * checkCanAdminList does NOT run here — the "no entity permission → FORBIDDEN" behavior is
 * covered by the service unit tests (T-007, accommodation.permissions/adminListPermission).
 * This file's job is the middleware GATE: that a VIEW_OWN-only host is no longer blocked.
 * Data-layer status (200 vs 400/500/503) is not asserted.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('GET /api/v1/admin/accommodations (SPEC-169 owner-scoping gate)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/admin/accommodations';

    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';

    const hostViewOwnHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'HOST',
        'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', 'accommodation.viewOwn'])
    };

    const adminViewAllHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', 'accommodation.viewAll'])
    };

    const requestStatus = async (headers?: Record<string, string>): Promise<number> => {
        try {
            const res = await app.request(
                base,
                headers ? { method: 'GET', headers } : { method: 'GET' }
            );
            return res.status;
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                return (error as { status: number }).status;
            }
            throw error;
        }
    };

    beforeAll(async () => {
        app = initApp();
    });

    it('returns 401/403 when no auth headers are provided', async () => {
        const status = await requestStatus();
        expect([400, 401, 403]).toContain(status);
    });

    // The core T-008 assertion: before SPEC-169 the route required VIEW_ALL, so a VIEW_OWN-only
    // host was blocked by the middleware with 403. Now the gate only needs admin access, so the
    // host passes the gate (reaching the — here mocked — service).
    it('accepts a VIEW_OWN-only host at the permission gate (not 403/404)', async () => {
        const status = await requestStatus(hostViewOwnHeaders);
        expect(status).not.toBe(403);
        expect(status).not.toBe(404);
    });

    it('accepts a VIEW_ALL staff actor at the permission gate (not 403/404)', async () => {
        const status = await requestStatus(adminViewAllHeaders);
        expect(status).not.toBe(403);
        expect(status).not.toBe(404);
    });
});
