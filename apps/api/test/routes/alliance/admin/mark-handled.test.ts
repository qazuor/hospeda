/**
 * Tests that mark-handled serializes the provisioning outcome (HOS-2339)
 *
 * POST /api/v1/admin/alliance/leads/:id/mark-handled
 *
 * The service is spied on: this suite owns the route contract (auth order,
 * status and error.code per case). Every case asserts the service call count
 * too, so a refusal cannot pass through a conditional assertion.
 */

import { PermissionEnum } from '@repo/schemas';
import { AllianceLeadService } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const LEAD_ID = '11111111-1111-4111-b111-111111111111';
const URL = `/api/v1/admin/alliance/leads/${LEAD_ID}/mark-handled`;
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

describe('POST /api/v1/admin/alliance/leads/:id/mark-handled provisioning outcome (HOS-2339)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const post = (status: string) =>
        app.request(URL, {
            method: 'POST',
            headers: authorized(),
            body: JSON.stringify({ status })
        });

    it('returns the provisioning outcome through the real route serialization', async () => {
        const spy = vi.spyOn(AllianceLeadService.prototype, 'markHandled').mockResolvedValue({
            data: {
                ...leadRow(),
                provisioning: { provisioned: false, reason: 'no-active-category' }
            }
        } as never);
        const res = await post('approved');
        const body = (await res.json()) as {
            data?: { status?: string; provisioning?: { provisioned?: boolean; reason?: string } };
        };
        expect(spy).toHaveBeenCalledOnce();
        expect(res.status).toBe(201);
        expect(body.data?.status).toBe('approved');
        expect(body.data?.provisioning).toEqual({
            provisioned: false,
            reason: 'no-active-category'
        });
    });

    it('omits the provisioning key when the service reports none (rejection)', async () => {
        const spy = vi.spyOn(AllianceLeadService.prototype, 'markHandled').mockResolvedValue({
            data: leadRow({ status: 'rejected' })
        } as never);
        const res = await post('rejected');
        const body = (await res.json()) as { data?: Record<string, unknown> };
        expect(spy).toHaveBeenCalledOnce();
        expect(res.status).toBe(201);
        expect(body.data).toBeDefined();
        expect(body.data).not.toHaveProperty('provisioning');
    });
});
