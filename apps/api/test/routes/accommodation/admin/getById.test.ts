/**
 * Tests for the admin accommodation detail + FAQs sub-tab route gates (SPEC-169 T-009).
 *
 * After SPEC-169 these routes no longer declare ACCOMMODATION_VIEW_ALL: the gate only requires
 * admin access, and the entity-specific permission (VIEW_ALL OR VIEW_OWN) + owner-scoping are
 * enforced in the service via adminGetById / adminGetFaqs → checkCanAdminView. So a VIEW_OWN-only
 * host must pass the middleware gate (it previously got 403 there).
 *
 * NOTE: route-level tests mock the service (see test/setup.ts), so the owner-scoping result
 * (own → 200, others → NOT_FOUND) is covered by the service unit tests
 * (accommodation.adminGetById.test.ts). This file asserts the MIDDLEWARE gate only.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('Admin accommodation detail/FAQs route gates (SPEC-169)', () => {
    let app: AppOpenAPI;
    const ACC_ID = '33333333-3333-4333-8333-333333333333';
    const detailPath = `/api/v1/admin/accommodations/${ACC_ID}`;
    const faqsPath = `/api/v1/admin/accommodations/${ACC_ID}/faqs`;

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

    const requestStatus = async (
        path: string,
        headers?: Record<string, string>
    ): Promise<number> => {
        try {
            const res = await app.request(
                path,
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

    it('detail: 401/403 without auth', async () => {
        expect([400, 401, 403]).toContain(await requestStatus(detailPath));
    });

    it('detail: VIEW_OWN host passes the gate (not 403/404)', async () => {
        const status = await requestStatus(detailPath, hostViewOwnHeaders);
        expect(status).not.toBe(403);
        expect(status).not.toBe(404);
    });

    it('detail: VIEW_ALL staff passes the gate (not 403/404)', async () => {
        const status = await requestStatus(detailPath, adminViewAllHeaders);
        expect(status).not.toBe(403);
        expect(status).not.toBe(404);
    });

    it('faqs sub-tab: VIEW_OWN host passes the gate (not 403/404)', async () => {
        const status = await requestStatus(faqsPath, hostViewOwnHeaders);
        expect(status).not.toBe(403);
        expect(status).not.toBe(404);
    });

    it('faqs sub-tab: VIEW_ALL staff passes the gate (not 403/404)', async () => {
        const status = await requestStatus(faqsPath, adminViewAllHeaders);
        expect(status).not.toBe(403);
        expect(status).not.toBe(404);
    });
});
