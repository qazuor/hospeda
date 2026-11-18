/**
 * @fileoverview
 * HOS-2339: `markHandled` reports the provisioning outcome, and the dedicated
 * `provisionListing` retry re-runs provisioning only.
 */

import {
    HostTradeBenefitTypeEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type AllianceClaimInvitePort,
    type AllianceDecisionNotifyPort,
    AllianceLeadService
} from '../../../src/services/alliance-lead/alliance-lead.service';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

vi.mock('../../../src/utils/transaction', () => ({
    withServiceTransaction: vi.fn(
        async (fn: (ctx: { tx: object; hookState: Record<string, unknown> }) => Promise<unknown>) =>
            fn({ tx: {}, hookState: {} })
    )
}));

const LEAD_ID = '00000000-0000-4000-a000-000000000002';
const ACTOR_ID = '00000000-0000-4000-a000-000000000010';
const HOST_TRADE_ID = '00000000-0000-4000-a000-000000000020';
const CATEGORY_ID = '00000000-0000-4000-a000-0000000000c1';

const admin: Actor = {
    id: ACTOR_ID,
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.ALLIANCE_LEAD_MANAGE]
};
const noPerm: Actor = { id: ACTOR_ID, roles: [RoleEnum.USER], permissions: [] };

const baseLead = {
    id: LEAD_ID,
    kind: 'service_provider' as string,
    contactName: 'Juan Perez',
    email: 'juan@example.com',
    phone: '+5491112345678',
    message: 'Quiero sumarme al directorio.',
    status: 'pending' as string,
    adminNote: null,
    applicantUserId: null as string | null,
    claimToken: null as string | null,
    claimExpiresAt: null as Date | null,
    provisionedHostTradeId: null as string | null,
    businessName: 'Plomeria Acme',
    category: null,
    categorySlugs: ['plomeria'] as string[] | null,
    destinationId: '00000000-0000-4000-a000-000000000030',
    benefitType: HostTradeBenefitTypeEnum.PERCENTAGE,
    benefitValue: 15,
    benefitText: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null as Date | null,
    createdById: null,
    updatedById: null,
    deletedById: null
};
const lead = (o: Record<string, unknown> = {}) => ({ ...baseLead, ...o });

const hostTradeModel = () => ({
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: HOST_TRADE_ID }),
    replaceCategories: vi.fn().mockResolvedValue({ added: [], removed: [] })
});
const categoryModel = (active: boolean) => ({
    findActiveBySlugs: vi
        .fn()
        .mockResolvedValue(active ? [{ id: CATEGORY_ID, slug: 'plomeria' }] : []),
    findByIdsForShare: vi
        .fn()
        .mockResolvedValue(
            active ? [{ id: CATEGORY_ID, lifecycleState: 'ACTIVE', deletedAt: null }] : []
        ),
    findIdsInDeletedGroups: vi.fn().mockResolvedValue([])
});

function build(params: {
    row: Record<string, unknown>;
    active?: boolean;
    inviteToClaim?: AllianceClaimInvitePort['inviteToClaim'];
    notifyDecision?: AllianceDecisionNotifyPort['notifyDecision'];
}) {
    const { row, active = true, inviteToClaim, notifyDecision } = params;
    const service = new AllianceLeadService(
        { logger: undefined },
        inviteToClaim ? { inviteToClaim } : undefined,
        notifyDecision ? { notifyDecision } : undefined
    );
    const model = {
        findById: vi.fn().mockResolvedValue(row),
        findByIdForUpdate: vi.fn().mockResolvedValue(row),
        update: vi.fn().mockImplementation(async (_w: unknown, data: Record<string, unknown>) => ({
            ...row,
            ...data
        }))
    };
    const ht = hostTradeModel();
    (service as any)._model = model;
    (service as any)._hostTradeModel = ht;
    (service as any)._categoryModel = categoryModel(active);
    return { service, model, ht };
}

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, perm) =>
        (actor as Actor).permissions.includes(perm)
    );
});

describe('markHandled provisioning outcome (HOS-2339)', () => {
    it('AC-1.1 reports provisioned: true with the hostTradeId', async () => {
        const { service } = build({ row: lead() });
        const r = await service.markHandled({
            actor: admin,
            id: LEAD_ID,
            input: { status: 'approved' }
        });
        expect(r.data?.provisioning).toEqual({ provisioned: true, hostTradeId: HOST_TRADE_ID });
    });

    it('AC-1.2 reports no-active-category when no chosen category is active', async () => {
        const { service } = build({ row: lead(), active: false });
        const r = await service.markHandled({
            actor: admin,
            id: LEAD_ID,
            input: { status: 'approved' }
        });
        expect(r.error).toBeUndefined();
        expect(r.data?.status).toBe('approved');
        expect(r.data?.provisioning).toEqual({ provisioned: false, reason: 'no-active-category' });
    });

    it('AC-1.3 reports legacy-lead-without-typed-fields', async () => {
        const { service } = build({
            row: lead({ businessName: null, categorySlugs: null })
        });
        const r = await service.markHandled({
            actor: admin,
            id: LEAD_ID,
            input: { status: 'approved' }
        });
        expect(r.data?.provisioning).toEqual({
            provisioned: false,
            reason: 'legacy-lead-without-typed-fields'
        });
    });

    it('AC-1.4 reports already-provisioned with the existing hostTradeId', async () => {
        const { service } = build({
            row: lead({ status: 'approved', provisionedHostTradeId: HOST_TRADE_ID })
        });
        const r = await service.markHandled({
            actor: admin,
            id: LEAD_ID,
            input: { status: 'approved' }
        });
        expect(r.data?.provisioning).toEqual({
            provisioned: false,
            reason: 'already-provisioned',
            hostTradeId: HOST_TRADE_ID
        });
    });

    it('AC-1.5 adds no provisioning key for a rejection', async () => {
        const { service } = build({ row: lead() });
        const r = await service.markHandled({
            actor: admin,
            id: LEAD_ID,
            input: { status: 'rejected' }
        });
        expect(r.data).toBeDefined();
        expect(r.data).not.toHaveProperty('provisioning');
    });

    it.each([
        'partner',
        'sponsor',
        'editor'
    ])('AC-1.5 adds no provisioning key when approving a %s lead', async (kind) => {
        const { service } = build({ row: lead({ kind }) });
        const r = await service.markHandled({
            actor: admin,
            id: LEAD_ID,
            input: { status: 'approved' }
        });
        expect(r.data).toBeDefined();
        expect(r.data).not.toHaveProperty('provisioning');
    });
});

describe('provisionListing (HOS-2339 D5)', () => {
    const approved = (o: Record<string, unknown> = {}) => lead({ status: 'approved', ...o });

    it('AC-4.1 creates the listing, links it and reports provisioned', async () => {
        const { service, model, ht } = build({ row: approved() });
        const r = await service.provisionListing({ actor: admin, id: LEAD_ID });
        expect(r.error).toBeUndefined();
        expect(r.data?.provisioning).toEqual({ provisioned: true, hostTradeId: HOST_TRADE_ID });
        expect(r.data?.provisionedHostTradeId).toBe(HOST_TRADE_ID);
        expect(ht.create).toHaveBeenCalledOnce();
        expect(model.findByIdForUpdate).toHaveBeenCalledOnce();
        const payload = model.update.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(payload.provisionedHostTradeId).toBe(HOST_TRADE_ID);
        expect(payload).not.toHaveProperty('status');
    });

    it('AC-4.2 still no active category: reports the skip and writes nothing', async () => {
        const { service, model, ht } = build({ row: approved(), active: false });
        const r = await service.provisionListing({ actor: admin, id: LEAD_ID });
        expect(r.error).toBeUndefined();
        expect(r.data?.provisioning).toEqual({ provisioned: false, reason: 'no-active-category' });
        expect(ht.create).not.toHaveBeenCalled();
        expect(model.update).not.toHaveBeenCalled();
    });

    it('AC-4.3 already provisioned: no second listing, existing id returned', async () => {
        const { service, model, ht } = build({
            row: approved({ provisionedHostTradeId: HOST_TRADE_ID })
        });
        const r = await service.provisionListing({ actor: admin, id: LEAD_ID });
        expect(r.data?.provisioning).toEqual({
            provisioned: false,
            reason: 'already-provisioned',
            hostTradeId: HOST_TRADE_ID
        });
        expect(ht.create).not.toHaveBeenCalled();
        expect(model.update).not.toHaveBeenCalled();
    });

    it('AC-4.5 sends only the claim invite for a newly created listing of an unclaimed lead', async () => {
        const inviteToClaim = vi
            .fn<AllianceClaimInvitePort['inviteToClaim']>()
            .mockResolvedValue(undefined);
        const notifyDecision = vi
            .fn<AllianceDecisionNotifyPort['notifyDecision']>()
            .mockResolvedValue(undefined);
        const { service, model } = build({ row: approved(), inviteToClaim, notifyDecision });
        await service.provisionListing({ actor: admin, id: LEAD_ID });
        expect(inviteToClaim).toHaveBeenCalledOnce();
        expect(notifyDecision).not.toHaveBeenCalled();
        const persisted = model.update.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(persisted.claimToken).not.toBe(inviteToClaim.mock.calls[0]?.[0].token);
        expect(persisted.claimExpiresAt).toBeInstanceOf(Date);
    });

    it('AC-4.5 sends no invite when the lead already has an applicant user', async () => {
        const inviteToClaim = vi
            .fn<AllianceClaimInvitePort['inviteToClaim']>()
            .mockResolvedValue(undefined);
        const notifyDecision = vi
            .fn<AllianceDecisionNotifyPort['notifyDecision']>()
            .mockResolvedValue(undefined);
        const { service } = build({
            row: approved({ applicantUserId: ACTOR_ID }),
            inviteToClaim,
            notifyDecision
        });
        await service.provisionListing({ actor: admin, id: LEAD_ID });
        expect(inviteToClaim).not.toHaveBeenCalled();
        expect(notifyDecision).not.toHaveBeenCalled();
    });

    it('AC-4.5 sends no invite when provisioning skips', async () => {
        const inviteToClaim = vi
            .fn<AllianceClaimInvitePort['inviteToClaim']>()
            .mockResolvedValue(undefined);
        const { service } = build({ row: approved(), active: false, inviteToClaim });
        await service.provisionListing({ actor: admin, id: LEAD_ID });
        expect(inviteToClaim).not.toHaveBeenCalled();
    });

    it('AC-4.6 refuses without ALLIANCE_LEAD_MANAGE', async () => {
        const { service } = build({ row: approved() });
        const r = await service.provisionListing({ actor: noPerm, id: LEAD_ID });
        expect(r.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('AC-4.6 answers NOT_FOUND for a missing or soft-deleted lead', async () => {
        const { service, model } = build({ row: approved() });
        model.findByIdForUpdate.mockResolvedValue(null);
        const missing = await service.provisionListing({ actor: admin, id: LEAD_ID });
        expect(missing.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        model.findByIdForUpdate.mockResolvedValue(approved({ deletedAt: new Date() }));
        const deleted = await service.provisionListing({ actor: admin, id: LEAD_ID });
        expect(deleted.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('AC-4.6 answers VALIDATION_ERROR NOT_A_SERVICE_PROVIDER, checked before status', async () => {
        const { service } = build({ row: lead({ kind: 'sponsor', status: 'pending' }) });
        const r = await service.provisionListing({ actor: admin, id: LEAD_ID });
        expect(r.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(r.error?.details).toMatchObject({ reason: 'NOT_A_SERVICE_PROVIDER' });
    });

    it('AC-4.6 answers ALREADY_EXISTS LEAD_NOT_APPROVED for a pending lead', async () => {
        const { service, ht } = build({ row: lead({ status: 'pending' }) });
        const r = await service.provisionListing({ actor: admin, id: LEAD_ID });
        expect(r.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(r.error?.details).toMatchObject({ reason: 'LEAD_NOT_APPROVED' });
        expect(ht.create).not.toHaveBeenCalled();
    });

    it('AC-4.8 persists nothing and logs the lead id when the link update fails', async () => {
        const { service, model } = build({ row: approved() });
        const error = vi.fn();
        (service as any).logger = { error, info: vi.fn(), warn: vi.fn(), debug: vi.fn() };
        model.update.mockRejectedValue(new Error('boom'));
        const r = await service.provisionListing({ actor: admin, id: LEAD_ID });
        expect(r.error).toBeDefined();
        expect(error).toHaveBeenCalledWith(
            expect.objectContaining({ leadId: LEAD_ID }),
            expect.stringContaining('provisioning retry failed')
        );
    });
});
