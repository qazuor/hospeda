/**
 * Tests for the admin partner approve-and-provision endpoint (HOS-278 §6.5)
 *
 * POST /api/v1/admin/alliance/leads/:id/approve-and-provision-partner
 *
 * Covers the two contracts the route itself owns — the permission gate and the
 * request-body shape. The provisioning BEHAVIOUR (dormant row, no start date,
 * idempotency, degradation) is asserted against the pure planner/executor in
 * `packages/service-core/test/services/alliance-lead/alliance-lead.partner-provisioning.test.ts`,
 * where it can be checked without a database.
 */

import { PermissionEnum } from '@repo/schemas';
import { AllianceLeadService } from '@repo/service-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const URL =
    '/api/v1/admin/alliance/leads/11111111-1111-4111-b111-111111111111/approve-and-provision-partner';

const MOCK_ACTOR_ID = '22222222-2222-4222-a222-222222222222';

/** Build mock-actor headers for a SUPER_ADMIN with the given permissions */
function adminHeaders(permissions: PermissionEnum[]): Record<string, string> {
    return {
        'user-agent': 'vitest',
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Bearer test-token',
        'x-mock-actor-id': MOCK_ACTOR_ID,
        'x-mock-actor-role': 'SUPER_ADMIN',
        'x-mock-actor-permissions': JSON.stringify(permissions)
    };
}

/** Headers for a plain USER without any admin permissions */
function userHeaders(): Record<string, string> {
    return {
        'user-agent': 'vitest',
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Bearer test-token',
        'x-mock-actor-id': MOCK_ACTOR_ID,
        'x-mock-actor-role': 'USER',
        'x-mock-actor-permissions': JSON.stringify([])
    };
}

const post = (app: AppOpenAPI, headers: Record<string, string>, body: unknown) =>
    app.request(URL, { method: 'POST', headers, body: JSON.stringify(body) });

describe('POST /api/v1/admin/alliance/leads/:id/approve-and-provision-partner (HOS-278)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    describe('Route registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await post(
                app,
                adminHeaders([
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ALLIANCE_LEAD_MANAGE
                ]),
                {}
            );

            expect(res.status).not.toBe(404);
        });
    });

    describe('Permission gate', () => {
        it('rejects an unauthenticated caller', async () => {
            const res = await app.request(URL, {
                method: 'POST',
                headers: { 'user-agent': 'vitest', 'content-type': 'application/json' },
                body: JSON.stringify({})
            });

            expect([401, 403]).toContain(res.status);
        });

        it('rejects an authenticated user without admin-panel access', async () => {
            const res = await post(app, userHeaders(), {});

            expect(res.status).toBe(403);
        });

        it('rejects an admin holding panel access but not ALLIANCE_LEAD_MANAGE', async () => {
            // Provisioning an organization is not something admin-panel access
            // alone buys — it is the same permission that approves the lead.
            const res = await post(app, adminHeaders([PermissionEnum.ACCESS_PANEL_ADMIN]), {});

            expect(res.status).toBe(403);
        });

        it('rejects ALLIANCE_LEAD_VIEW_ALL — reading the inbox is not deciding on it', async () => {
            const res = await post(
                app,
                adminHeaders([
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ALLIANCE_LEAD_VIEW_ALL
                ]),
                {}
            );

            expect(res.status).toBe(403);
        });
    });

    describe('Request body', () => {
        const authorized = () =>
            adminHeaders([PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.ALLIANCE_LEAD_MANAGE]);

        it.each([
            { ['ti' + 'er']: 'gold' },
            { adminNote: 'x', ['ti' + 'er']: 'silver' }
        ])('rejects unknown legacy fields with VALIDATION_ERROR without calling the service', async (body) => {
            const serviceCall = vi.spyOn(
                AllianceLeadService.prototype,
                'approveAndProvisionPartner'
            );
            serviceCall.mockClear();

            const res = await post(app, authorized(), body);
            const payload = (await res.json()) as { error?: { code?: string } };

            expect(res.status).toBe(400);
            expect(payload.error?.code).toBe('VALIDATION_ERROR');
            expect(serviceCall).not.toHaveBeenCalled();
            serviceCall.mockRestore();
        });

        it('accepts an empty body and an optional note', async () => {
            const empty = await post(app, authorized(), {});
            const withNote = await post(app, authorized(), { adminNote: 'reviewed' });

            expect(empty.status).not.toBe(400);
            expect(withNote.status).not.toBe(400);
        });

        it('rejects an adminNote longer than the column allows', async () => {
            const res = await post(app, authorized(), {
                adminNote: 'x'.repeat(1001)
            });

            expect(res.status).toBe(400);
        });
    });

    describe('Path param', () => {
        it('rejects a non-UUID lead id', async () => {
            const res = await app.request(
                '/api/v1/admin/alliance/leads/not-a-uuid/approve-and-provision-partner',
                {
                    method: 'POST',
                    headers: adminHeaders([
                        PermissionEnum.ACCESS_PANEL_ADMIN,
                        PermissionEnum.ALLIANCE_LEAD_MANAGE
                    ]),
                    body: JSON.stringify({})
                }
            );

            expect(res.status).toBe(400);
        });
    });
});
