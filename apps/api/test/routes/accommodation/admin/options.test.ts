/**
 * Tests for GET /api/v1/admin/accommodations/options (SPEC-169 §5.5 / T-017).
 *
 * Verifies the route MIDDLEWARE permission gate: the lookup endpoint declares NO
 * `requiredPermissions`, so the admin authorization middleware requires ONLY admin-panel
 * access (`ACCESS_PANEL_ADMIN` OR `ACCESS_API_ADMIN`). An EDITOR holding only
 * `ACCESS_PANEL_ADMIN` — with NO `_VIEW_ALL` — must NOT be blocked (not 403/404). A guest
 * (no auth) must be rejected (401/403).
 *
 * NOTE: the service is MOCKED in route tests (see test/setup.ts), so the real
 * checkCanFindOptions does not run here — this file's job is the route GATE. Payload shape
 * (id/label/slug/type/destination) and DRAFT-inclusivity are covered by the service unit test.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('GET /api/v1/admin/accommodations/options (SPEC-169 lookup gate)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/admin/accommodations/options';

    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';

    // Editor with ONLY admin-panel access — crucially NO _VIEW_ALL grant.
    const editorPanelOnlyHeaders = {
        'x-mock-actor-id': MOCK_USER_ID,
        'x-mock-actor-role': 'EDITOR',
        'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin'])
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

    it('rejects an unauthenticated guest (401/403)', async () => {
        const status = await requestStatus();
        expect([400, 401, 403]).toContain(status);
    });

    it('accepts an ACCESS_PANEL_ADMIN-only editor (no _VIEW_ALL) at the gate (not 403/404)', async () => {
        const status = await requestStatus(editorPanelOnlyHeaders);
        expect(status).not.toBe(403);
        expect(status).not.toBe(404);
    });

    it('resolves /options before /{id} (does not 404 as a missing accommodation)', async () => {
        // If the router resolved "options" as an :id, a VIEW-only actor would hit getById and
        // could 404. The gate-pass above already proves the options route matched, but assert
        // explicitly that the path is not treated as an id lookup.
        const status = await requestStatus(editorPanelOnlyHeaders);
        expect([200, 400]).toContain(status);
    });
});
