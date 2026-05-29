/**
 * Tests for GET /api/v1/admin/event-organizers/options (SPEC-169 §5.5 / T-018).
 *
 * Verifies the route MIDDLEWARE permission gate: the lookup endpoint declares NO
 * `requiredPermissions`, so the admin authorization middleware requires ONLY admin-panel
 * access (`ACCESS_PANEL_ADMIN` OR `ACCESS_API_ADMIN`). An EDITOR holding only
 * `ACCESS_PANEL_ADMIN` — with NO `EVENT_ORGANIZER_VIEW` — must NOT be blocked (not 403/404).
 * A guest (no auth) must be rejected (401/403).
 *
 * NOTE: the service is MOCKED in route tests (see test/setup.ts), so the real
 * checkCanFindOptions does not run here — this file's job is the route GATE. Payload shape
 * (id/label/slug) and DRAFT-inclusivity are covered by the service unit test.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('GET /api/v1/admin/event-organizers/options (SPEC-169 lookup gate)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/admin/event-organizers/options';

    const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';

    // Editor with ONLY admin-panel access — crucially NO EVENT_ORGANIZER_VIEW grant.
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

    it('accepts an ACCESS_PANEL_ADMIN-only editor (no EVENT_ORGANIZER_VIEW) at the gate (not 403/404)', async () => {
        const status = await requestStatus(editorPanelOnlyHeaders);
        expect(status).not.toBe(403);
        expect(status).not.toBe(404);
    });

    it('resolves /options before /{id} (does not 404 as a missing organizer)', async () => {
        const status = await requestStatus(editorPanelOnlyHeaders);
        expect([200, 400]).toContain(status);
    });
});
