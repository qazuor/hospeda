/**
 * HOS-2336 AC-2.2: approve-and-provision answers `201` with
 * `partnerId: null, provisioned: false, reason: 'no-active-partner-type'` when
 * the lead's partner type was deactivated or deleted after submission. The
 * `reason` field is additive: a provisioned response carries none.
 *
 * @module test/routes/alliance/admin/approve-and-provision-partner.reason
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const { mockApprove } = vi.hoisted(() => ({ mockApprove: vi.fn() }));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AllianceLeadService: vi.fn().mockImplementation(function () {
            return { approveAndProvisionPartner: mockApprove };
        })
    };
});

vi.mock('../../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { adminApproveAndProvisionPartnerRoute } = await import(
    '../../../../src/routes/alliance/admin/approve-and-provision-partner.js'
);

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const LEAD_ID = '22222222-2222-4222-8222-222222222222';
const PARTNER_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date().toISOString();

const LEAD = {
    id: LEAD_ID,
    kind: 'partner',
    contactName: 'Juan',
    email: 'juan@example.com',
    phone: null,
    message: 'Queremos proponer una alianza institucional.',
    status: 'approved',
    adminNote: null,
    applicantUserId: null,
    businessName: 'Acme',
    partnerType: 'ngo',
    categorySlugs: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('actor', {
            id: ACTOR_ID,
            roles: [RoleEnum.ADMIN],
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.ALLIANCE_LEAD_MANAGE]
        });
        return next();
    });
    app.route('/', adminApproveAndProvisionPartnerRoute);
    return app;
}

const post = () => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
});

beforeEach(() => {
    mockApprove.mockReset();
});

describe('approve-and-provision — reason (HOS-2336)', () => {
    it('201 with partnerId null and reason no-active-partner-type (AC-2.2)', async () => {
        mockApprove.mockResolvedValue({
            data: {
                lead: LEAD,
                partnerId: null,
                provisioned: false,
                reason: 'no-active-partner-type'
            }
        });

        const res = await buildApp().request(`/${LEAD_ID}/approve-and-provision-partner`, post());
        const body = await res.json();

        expect(res.status, JSON.stringify(body)).toBe(201);
        expect(body.data).toMatchObject({
            partnerId: null,
            provisioned: false,
            reason: 'no-active-partner-type'
        });
    });

    it('201 without reason when the partner was provisioned (AC-2.1)', async () => {
        mockApprove.mockResolvedValue({
            data: { lead: LEAD, partnerId: PARTNER_ID, provisioned: true }
        });

        const res = await buildApp().request(`/${LEAD_ID}/approve-and-provision-partner`, post());
        const body = await res.json();

        expect(res.status, JSON.stringify(body)).toBe(201);
        expect(body.data).toMatchObject({ partnerId: PARTNER_ID, provisioned: true });
        expect(body.data).not.toHaveProperty('reason');
    });
});
