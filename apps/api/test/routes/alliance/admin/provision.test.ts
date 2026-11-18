/**
 * Tests for the admin provisioning retry endpoint (HOS-2339)
 *
 * POST /api/v1/admin/alliance/leads/:id/provision
 *
 * The service is spied on: this suite owns the route contract (auth order,
 * status and error.code per case). Every case asserts the service call count
 * too, so a refusal cannot pass through a conditional assertion.
 */

import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { AllianceLeadService } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const LEAD_ID = '11111111-1111-4111-b111-111111111111';
const HOST_TRADE_ID = '33333333-3333-4333-a333-333333333333';
const URL = `/api/v1/admin/alliance/leads/${LEAD_ID}/provision`;
const MOCK_ACTOR_ID = '22222222-2222-4222-a222-222222222222';
const AUTH_HEADER = ['Bearer', 'test-token'].join(' ');

function adminHeaders(permissions: PermissionEnum[]): Record<string, string> {
    return {
        'user-agent': 'vitest',
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: AUTH_HEADER,
        'x-mock-actor-id': MOCK_ACTOR_ID,
        'x-mock-actor-role': 'SUPER_ADMIN',
        'x-mock-actor-permissions': JSON.stringify(permissions)
    };
}

const authorized = () =>
    adminHeaders([PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.ALLIANCE_LEAD_MANAGE]);

const leadRow = (extra: Record<string, unknown> = {}) => ({
    id: LEAD_ID,
    kind: 'service_provider',
    contactName: 'Juan Perez',
    email: 'juan@example.com',
    phone: '+5491112345678',
    message: 'Quiero sumarme al directorio.',
    status: 'approved',
    adminNote: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdById: null,
    updatedById: null,
    deletedAt: null,
    deletedById: null,
    ...extra
});

describe('POST /api/v1/admin/alliance/leads/:id/provision (HOS-2339)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const post = (headers: Record<string, string>, url = URL) =>
        app.request(url, { method: 'POST', headers });

    it('401 for an unauthenticated caller, service never called', async () => {
        const spy = vi.spyOn(AllianceLeadService.prototype, 'provisionListing');
        const res = await app.request(URL, {
            method: 'POST',
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(401);
        expect(spy).not.toHaveBeenCalled();
    });

    it('403 for an admin without ALLIANCE_LEAD_MANAGE, service never called', async () => {
        const spy = vi.spyOn(AllianceLeadService.prototype, 'provisionListing');
        const res = await post(
            adminHeaders([PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.ALLIANCE_LEAD_VIEW_ALL])
        );
        expect(res.status).toBe(403);
        expect(spy).not.toHaveBeenCalled();
    });

    it('400 VALIDATION_ERROR for a non-UUID id, service never called', async () => {
        const spy = vi.spyOn(AllianceLeadService.prototype, 'provisionListing');
        const res = await post(authorized(), '/api/v1/admin/alliance/leads/not-a-uuid/provision');
        const body = (await res.json()) as { error?: { code?: string } };
        expect(res.status).toBe(400);
        expect(body.error?.code).toBe('VALIDATION_ERROR');
        expect(spy).not.toHaveBeenCalled();
    });

    it('404 NOT_FOUND when the lead does not exist', async () => {
        const spy = vi.spyOn(AllianceLeadService.prototype, 'provisionListing').mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Alliance lead not found' }
        });
        const res = await post(authorized());
        const body = (await res.json()) as { error?: { code?: string } };
        expect(spy).toHaveBeenCalledOnce();
        expect(res.status).toBe(404);
        expect(body.error?.code).toBe('NOT_FOUND');
    });

    it('422 VALIDATION_ERROR with details.reason NOT_A_SERVICE_PROVIDER', async () => {
        const spy = vi.spyOn(AllianceLeadService.prototype, 'provisionListing').mockResolvedValue({
            error: {
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: 'not a provider',
                reason: 'NOT_A_SERVICE_PROVIDER'
            }
        });
        const res = await post(authorized());
        const body = (await res.json()) as {
            error?: { code?: string; details?: { reason?: string } };
        };
        expect(spy).toHaveBeenCalledOnce();
        expect(res.status).toBe(422);
        expect(body.error?.code).toBe('VALIDATION_ERROR');
        expect(body.error?.details?.reason).toBe('NOT_A_SERVICE_PROVIDER');
    });

    it('409 ALREADY_EXISTS with details.reason LEAD_NOT_APPROVED', async () => {
        const spy = vi.spyOn(AllianceLeadService.prototype, 'provisionListing').mockResolvedValue({
            error: {
                code: ServiceErrorCode.ALREADY_EXISTS,
                message: 'not approved',
                reason: 'LEAD_NOT_APPROVED'
            }
        });
        const res = await post(authorized());
        const body = (await res.json()) as {
            error?: { code?: string; details?: { reason?: string } };
        };
        expect(spy).toHaveBeenCalledOnce();
        expect(res.status).toBe(409);
        expect(body.error?.code).toBe('ALREADY_EXISTS');
        expect(body.error?.details?.reason).toBe('LEAD_NOT_APPROVED');
    });

    it('200 with provisioning.provisioned = true', async () => {
        const spy = vi.spyOn(AllianceLeadService.prototype, 'provisionListing').mockResolvedValue({
            data: {
                ...leadRow({ provisionedHostTradeId: HOST_TRADE_ID }),
                provisioning: { provisioned: true, hostTradeId: HOST_TRADE_ID }
            }
        } as never);
        const res = await post(authorized());
        const body = (await res.json()) as {
            data?: { provisioning?: { provisioned?: boolean; hostTradeId?: string } };
        };
        expect(spy).toHaveBeenCalledOnce();
        expect(spy.mock.calls[0]?.[0]).toMatchObject({ id: LEAD_ID });
        expect(res.status).toBe(200);
        expect(body.data?.provisioning).toEqual({ provisioned: true, hostTradeId: HOST_TRADE_ID });
    });

    it.each([
        ['no-active-category', undefined],
        ['legacy-lead-without-typed-fields', undefined],
        ['already-provisioned', HOST_TRADE_ID]
    ])('200 with a skip outcome (%s) is not an error', async (reason, hostTradeId) => {
        const spy = vi.spyOn(AllianceLeadService.prototype, 'provisionListing').mockResolvedValue({
            data: {
                ...leadRow(),
                provisioning: {
                    provisioned: false,
                    reason,
                    ...(hostTradeId ? { hostTradeId } : {})
                }
            }
        } as never);
        const res = await post(authorized());
        const body = (await res.json()) as {
            data?: { provisioning?: { provisioned?: boolean; reason?: string } };
        };
        expect(spy).toHaveBeenCalledOnce();
        expect(res.status).toBe(200);
        expect(body.data?.provisioning?.provisioned).toBe(false);
        expect(body.data?.provisioning?.reason).toBe(reason);
    });

    it('never answers INTERNAL_ERROR for a business refusal', async () => {
        const spy = vi.spyOn(AllianceLeadService.prototype, 'provisionListing').mockResolvedValue({
            error: {
                code: ServiceErrorCode.ALREADY_EXISTS,
                message: 'not approved',
                reason: 'LEAD_NOT_APPROVED'
            }
        });
        const res = await post(authorized());
        const body = (await res.json()) as { error?: { code?: string } };
        expect(spy).toHaveBeenCalledOnce();
        expect(body.error?.code).not.toBe('INTERNAL_ERROR');
    });
});
