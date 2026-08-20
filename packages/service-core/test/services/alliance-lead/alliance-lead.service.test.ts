/**
 * alliance-lead.service.test.ts
 *
 * Unit tests for AllianceLeadService (HOS-277). All DB interactions are mocked.
 */

import { createHash } from 'node:crypto';
import {
    HostTradeBenefitTypeEnum,
    HostTradeCategoryEnum,
    PartnerTypeEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AllianceLeadService } from '../../../src/services/alliance-lead/alliance-lead.service';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

/**
 * `claimLead` opens a real `withServiceTransaction` boundary when a claim is
 * about to backfill a provisioned listing's owner (HOS-278 regression fix).
 * Unit tests have no real DB, so — same established pattern as
 * `test/services/accommodation/create.test.ts` — `withServiceTransaction` is
 * mocked to run its callback inline with a stub `ctx`, instead of opening a
 * Drizzle transaction. Every OTHER test in this file never reaches that
 * branch (no lead here carries a `provisionedHostTradeId` unless a test sets
 * one), so this mock changes nothing for them.
 */
vi.mock('../../../src/utils/transaction', () => ({
    withServiceTransaction: vi.fn(
        async (fn: (ctx: { tx: object; hookState: Record<string, unknown> }) => Promise<unknown>) =>
            fn({ tx: {}, hookState: {} })
    )
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LEAD_ID = '00000000-0000-4000-a000-000000000002';
const ACTOR_ID = '00000000-0000-4000-a000-000000000010';
const GUEST_ID = '00000000-0000-4000-a000-000000000011';
const HOST_TRADE_ID = '00000000-0000-4000-a000-000000000020';
const PARTNER_ID = '00000000-0000-4000-a000-000000000021';

const adminActor: Actor = {
    id: ACTOR_ID,
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.ALLIANCE_LEAD_VIEW_ALL, PermissionEnum.ALLIANCE_LEAD_MANAGE]
};

const guestActor: Actor = {
    id: GUEST_ID,
    roles: [RoleEnum.GUEST],
    permissions: []
};

const authenticatedActor: Actor = {
    id: ACTOR_ID,
    roles: [RoleEnum.USER],
    permissions: []
};

const createInput = {
    kind: 'partner' as const,
    contactName: 'Juan Pérez',
    email: 'juan@example.com',
    phone: '+5491112345678',
    message:
        'Nombre del negocio: Acme SA\nSitio web: https://acme.com\n\nMensaje:\nQuiero sumarme.',
    // partnerType is required for kind='partner' since HOS-278 provisioning
    // slice D (refineAllianceLeadKindFields) — without it, createLead's
    // AllianceLeadSubmissionSchema.parse rejects every fixture below.
    partnerType: PartnerTypeEnum.COMMERCE
};

const mockLead = {
    id: LEAD_ID,
    ...createInput,
    status: 'pending' as string,
    adminNote: null,
    applicantUserId: null as string | null,
    claimToken: null as string | null,
    claimExpiresAt: null as Date | null,
    provisionedHostTradeId: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};

// ---------------------------------------------------------------------------
// Model mock factory
// ---------------------------------------------------------------------------

function makeLeadModel(lead: Record<string, unknown> = mockLead) {
    return {
        create: vi.fn().mockResolvedValue(lead),
        findAll: vi.fn().mockResolvedValue({ items: [lead], total: 1 }),
        findById: vi.fn().mockResolvedValue(lead),
        update: vi.fn().mockResolvedValue({ ...lead, status: 'approved' })
    };
}

/** Mock factory for `HostTradeModel`, used by the claim-time owner backfill. */
/**
 * Mock factory for `HostTradeModel`, used by the claim-time owner backfill.
 *
 * `ownerUserId` admits `undefined` as well as `null` for the same reason its
 * partner sibling below does: the schema declares it `.nullish()`, the backfill
 * has to read both as "empty", and a mock that cannot express `undefined`
 * cannot catch a check that only handles `null`.
 */
function makeHostTradeModel(
    hostTrade: { id: string; ownerUserId?: string | null } = {
        id: HOST_TRADE_ID,
        ownerUserId: null
    }
) {
    return {
        findById: vi.fn().mockResolvedValue(hostTrade),
        update: vi.fn().mockResolvedValue({ ...hostTrade, ownerUserId: hostTrade.ownerUserId })
    };
}

/**
 * Mock factory for `PartnerModel`, used by the claim-time owner backfill.
 *
 * `ownerUserId` is typed to admit `undefined` as well as `null` because the
 * schema declares it `.nullish()` — and the backfill has to treat both as
 * "empty", so the mock must be able to express both.
 */
function makePartnerModel(
    partner: { id: string; ownerUserId?: string | null } = {
        id: PARTNER_ID,
        ownerUserId: null
    }
) {
    return {
        findById: vi.fn().mockResolvedValue(partner),
        update: vi.fn().mockResolvedValue({ ...partner, ownerUserId: partner.ownerUserId })
    };
}

function makeService() {
    return new AllianceLeadService({ logger: undefined });
}

/**
 * A `service_provider` lead carrying everything `provisionServiceProviderListing`
 * needs, for the HOS-599 markHandled claim-invite tests below. Defaults to
 * `pending` + unclaimed (`applicantUserId: null`) + never provisioned — the
 * ordinary "first approval" shape.
 */
function providerLead(overrides: Record<string, unknown> = {}) {
    return {
        ...mockLead,
        kind: 'service_provider' as const,
        status: 'pending' as string,
        businessName: 'Plomería Acme',
        category: HostTradeCategoryEnum.PLOMERIA,
        destinationId: '00000000-0000-4000-a000-000000000030',
        benefitType: HostTradeBenefitTypeEnum.PERCENTAGE,
        benefitValue: 15,
        benefitText: 'No acumulable.',
        ...overrides
    };
}

/**
 * Mock factory for `HostTradeModel` as `provisionServiceProviderListing` uses
 * it (slug-uniqueness check + insert) — distinct from `makeHostTradeModel`
 * above, which mocks the `findById`/`update` pair the CLAIM-time owner
 * backfill uses instead.
 */
function makeProvisioningHostTradeModel() {
    return {
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: HOST_TRADE_ID })
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, perm) =>
        (actor as Actor).permissions.includes(perm)
    );
});

describe('AllianceLeadService', () => {
    describe('createLead', () => {
        it('should create a lead and return it (no createdById set)', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.createLead({ actor: guestActor, input: createInput });

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.kind).toBe('partner');
            expect(result.data?.email).toBe('juan@example.com');
        });

        it('should not require any permission (public endpoint)', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.createLead({ actor: guestActor, input: createInput });

            expect(result.error).toBeUndefined();
        });

        it('should return VALIDATION_ERROR for invalid email', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.createLead({
                actor: guestActor,
                input: { ...createInput, email: 'not-an-email' }
            });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });

        it('should return VALIDATION_ERROR for an invalid kind', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.createLead({
                actor: guestActor,
                input: { ...createInput, kind: 'not-a-kind' as any }
            });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });

        // HOS-278 AC-1 / AC-2 — the account link is derived from the actor.
        it('should link the lead to an authenticated submitter (AC-1)', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            await service.createLead({ actor: authenticatedActor, input: createInput });

            expect(model.create).toHaveBeenCalledWith(
                expect.objectContaining({ applicantUserId: ACTOR_ID }),
                undefined
            );
        });

        it('should leave an anonymous submission unlinked (AC-2)', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            await service.createLead({ actor: guestActor, input: createInput });

            expect(model.create).toHaveBeenCalledWith(
                expect.objectContaining({ applicantUserId: null }),
                undefined
            );
        });

        it('should leave a roleless actor unlinked rather than guessing an owner', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            await service.createLead({
                actor: { id: ACTOR_ID, roles: [], permissions: [] },
                input: createInput
            });

            expect(model.create).toHaveBeenCalledWith(
                expect.objectContaining({ applicantUserId: null }),
                undefined
            );
        });

        it('should ignore an applicantUserId supplied in the request body (R-1)', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            await service.createLead({
                actor: guestActor,
                input: {
                    ...createInput,
                    // A caller trying to hang their application off someone
                    // else's account. The create schema omits the field, so Zod
                    // strips it before it can reach the model.
                    applicantUserId: ACTOR_ID
                } as any
            });

            expect(model.create).toHaveBeenCalledWith(
                expect.objectContaining({ applicantUserId: null }),
                undefined
            );
        });

        it('should return VALIDATION_ERROR for a too-short message', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.createLead({
                actor: guestActor,
                input: { ...createInput, message: 'short' }
            });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    // HOS-278 A4 — claim token issuance on anonymous submissions.
    describe('createLead — claim token issuance', () => {
        it('should mint a claim token for an anonymous submission and store only its digest', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            await service.createLead({ actor: guestActor, input: createInput });

            const written = model.create.mock.calls[0]?.[0];
            expect(written.claimToken).toEqual(expect.any(String));
            // sha256 hex
            expect(written.claimToken).toMatch(/^[0-9a-f]{64}$/);
            expect(written.claimExpiresAt).toBeInstanceOf(Date);
        });

        it('should expire the claim 7 days out', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            const before = Date.now();
            await service.createLead({ actor: guestActor, input: createInput });
            const after = Date.now();

            const written = model.create.mock.calls[0]?.[0];
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            expect(written.claimExpiresAt.getTime()).toBeGreaterThanOrEqual(before + sevenDays);
            expect(written.claimExpiresAt.getTime()).toBeLessThanOrEqual(after + sevenDays);
        });

        it('should mint a DIFFERENT token per submission', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            await service.createLead({ actor: guestActor, input: createInput });
            await service.createLead({ actor: guestActor, input: createInput });

            const first = model.create.mock.calls[0]?.[0]?.claimToken;
            const second = model.create.mock.calls[1]?.[0]?.claimToken;
            expect(first).not.toBe(second);
        });

        it('should NOT mint a claim token when the submitter is authenticated', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            await service.createLead({ actor: authenticatedActor, input: createInput });

            const written = model.create.mock.calls[0]?.[0];
            expect(written.claimToken).toBeNull();
            expect(written.claimExpiresAt).toBeNull();
        });

        it('should hand the RAW token to the invite port, never the digest', async () => {
            const inviteToClaim = vi.fn().mockResolvedValue(undefined);
            const service = new AllianceLeadService({ logger: undefined }, { inviteToClaim });
            const model = makeLeadModel();
            (service as any)._model = model;

            await service.createLead({ actor: guestActor, input: createInput });

            expect(inviteToClaim).toHaveBeenCalledOnce();
            const invite = inviteToClaim.mock.calls[0]?.[0];
            const written = model.create.mock.calls[0]?.[0];
            expect(invite.token).not.toBe(written.claimToken);
            expect(invite.token).not.toMatch(/^[0-9a-f]{64}$/);
            expect(invite.leadId).toBe(LEAD_ID);
            expect(invite.email).toBe('juan@example.com');
        });

        it('should not invite anyone when the submitter is authenticated', async () => {
            const inviteToClaim = vi.fn().mockResolvedValue(undefined);
            const service = new AllianceLeadService({ logger: undefined }, { inviteToClaim });
            (service as any)._model = makeLeadModel();

            await service.createLead({ actor: authenticatedActor, input: createInput });

            expect(inviteToClaim).not.toHaveBeenCalled();
        });

        it('should still succeed when the invitation fails to send', async () => {
            const inviteToClaim = vi.fn().mockRejectedValue(new Error('SMTP down'));
            const service = new AllianceLeadService({ logger: undefined }, { inviteToClaim });
            (service as any)._model = makeLeadModel();

            const result = await service.createLead({ actor: guestActor, input: createInput });

            expect(result.error).toBeUndefined();
            expect(result.data?.id).toBe(LEAD_ID);
        });

        it('should work with no invite port injected at all', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.createLead({ actor: guestActor, input: createInput });

            expect(result.error).toBeUndefined();
        });
    });

    // HOS-278 AC-4 — redeeming the emailed token is the ONLY way an anonymous
    // lead gets linked.
    describe('claimLead', () => {
        const RAW_TOKEN = 'raw-token-value';
        const TOKEN_DIGEST = createHash('sha256').update(RAW_TOKEN, 'utf8').digest('hex');

        const claimant: Actor = {
            id: ACTOR_ID,
            roles: [RoleEnum.USER],
            permissions: [],
            email: 'juan@example.com'
        };

        function claimableLead(overrides: Record<string, unknown> = {}) {
            return {
                ...mockLead,
                applicantUserId: null,
                claimToken: TOKEN_DIGEST,
                claimExpiresAt: new Date(Date.now() + 60_000),
                ...overrides
            };
        }

        it('should link the lead when token, expiry and email owner all check out', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead());
            (service as any)._model = model;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error).toBeUndefined();
            expect(model.update).toHaveBeenCalledWith(
                { id: LEAD_ID },
                { applicantUserId: ACTOR_ID, claimToken: null, claimExpiresAt: null },
                undefined
            );
        });

        // HOS-278 regression — approve-then-claim ordering. Provisioning writes
        // `ownerUserId: lead.applicantUserId` at APPROVAL time, which is `null`
        // for an anonymous submission whose email already had an account. The
        // listing must not stay ownerless forever once the recipient redeems
        // the claim token.
        it('should backfill the provisioned listing owner when an anonymous lead is claimed after approval', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead({ provisionedHostTradeId: HOST_TRADE_ID }));
            (service as any)._model = model;
            const hostTradeModel = makeHostTradeModel({ id: HOST_TRADE_ID, ownerUserId: null });
            (service as any)._hostTradeModel = hostTradeModel;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error).toBeUndefined();
            const [where, data] = hostTradeModel.update.mock.calls[0] ?? [];
            expect(where).toEqual({ id: HOST_TRADE_ID });
            expect(data).toEqual(expect.objectContaining({ ownerUserId: ACTOR_ID }));
        });

        it('should NOT move an already-owned listing to the claiming actor', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead({ provisionedHostTradeId: HOST_TRADE_ID }));
            (service as any)._model = model;
            const hostTradeModel = makeHostTradeModel({
                id: HOST_TRADE_ID,
                ownerUserId: 'someone-else-id'
            });
            (service as any)._hostTradeModel = hostTradeModel;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error).toBeUndefined();
            expect(hostTradeModel.update).not.toHaveBeenCalled();
        });

        // The host-trade mirror of the partner case further down. Both links go
        // through one shared `backfillProvisionedOwner` today, so a single test
        // happens to cover both — but only by coincidence of the current
        // factoring. Re-inlining this branch with a strict `=== null` check
        // leaves the partner test green and this listing ownerless forever
        // while the claim reports success, which is exactly what happened
        // before the helper existed.
        it('should treat an UNDEFINED host trade owner as empty, not as already owned', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead({ provisionedHostTradeId: HOST_TRADE_ID }));
            (service as any)._model = model;
            const hostTradeModel = makeHostTradeModel({
                id: HOST_TRADE_ID,
                ownerUserId: undefined
            });
            (service as any)._hostTradeModel = hostTradeModel;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error).toBeUndefined();
            const [where, data] = hostTradeModel.update.mock.calls[0] ?? [];
            expect(where).toEqual({ id: HOST_TRADE_ID });
            expect(data).toEqual(expect.objectContaining({ ownerUserId: ACTOR_ID }));
        });

        it('should not touch the host trade model when the lead has no provisioned listing', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead({ provisionedHostTradeId: null }));
            (service as any)._model = model;
            const hostTradeModel = makeHostTradeModel();
            (service as any)._hostTradeModel = hostTradeModel;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error).toBeUndefined();
            expect(hostTradeModel.findById).not.toHaveBeenCalled();
            expect(hostTradeModel.update).not.toHaveBeenCalled();
        });

        // HOS-278 D1 — the partner side of the same story. Provisioning a
        // partner copies `lead.applicantUserId` into `partners.ownerUserId`,
        // which is null for an anonymous submission. This is the only moment
        // that null can be resolved; nothing else ever writes that column.
        it('should backfill the provisioned partner owner when an anonymous lead is claimed', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead({ provisionedPartnerId: PARTNER_ID }));
            (service as any)._model = model;
            const partnerModel = makePartnerModel({ id: PARTNER_ID, ownerUserId: null });
            (service as any)._partnerModel = partnerModel;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error).toBeUndefined();
            const [where, data] = partnerModel.update.mock.calls[0] ?? [];
            expect(where).toEqual({ id: PARTNER_ID });
            expect(data).toEqual(expect.objectContaining({ ownerUserId: ACTOR_ID }));
        });

        // `ownerUserId` is declared `.nullish()`, so an absent owner can arrive
        // as `undefined` rather than `null`. A strict `=== null` emptiness check
        // reads that as "already owned" and skips the backfill — the partner
        // stays ownerless forever while the claim reports success.
        it('should treat an UNDEFINED partner owner as empty, not as already owned', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead({ provisionedPartnerId: PARTNER_ID }));
            (service as any)._model = model;
            const partnerModel = makePartnerModel({ id: PARTNER_ID, ownerUserId: undefined });
            (service as any)._partnerModel = partnerModel;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error).toBeUndefined();
            const [where, data] = partnerModel.update.mock.calls[0] ?? [];
            expect(where).toEqual({ id: PARTNER_ID });
            expect(data).toEqual(expect.objectContaining({ ownerUserId: ACTOR_ID }));
        });

        // The transaction decision is computed BEFORE `applyClaim` runs, from
        // its own boolean. If that boolean only consults the host-trade link, a
        // partner-only lead runs its backfill with no boundary at all: the
        // result still looks right, so only the tx handle reaching the model
        // can tell the two apart.
        it('should open a transaction for a partner-only lead, not just a listing one', async () => {
            const service = makeService();
            const model = makeLeadModel(
                claimableLead({
                    provisionedHostTradeId: null,
                    provisionedPartnerId: PARTNER_ID
                })
            );
            (service as any)._model = model;
            const partnerModel = makePartnerModel({ id: PARTNER_ID, ownerUserId: null });
            (service as any)._partnerModel = partnerModel;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error).toBeUndefined();
            const [, , tx] = partnerModel.update.mock.calls[0] ?? [];
            expect(tx).toBeDefined();
        });

        it('should NOT move an already-owned partner to the claiming actor', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead({ provisionedPartnerId: PARTNER_ID }));
            (service as any)._model = model;
            const partnerModel = makePartnerModel({
                id: PARTNER_ID,
                ownerUserId: 'someone-else-id'
            });
            (service as any)._partnerModel = partnerModel;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error).toBeUndefined();
            expect(partnerModel.update).not.toHaveBeenCalled();
        });

        it('should not touch the partner model when the lead has no provisioned partner', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead({ provisionedPartnerId: null }));
            (service as any)._model = model;
            const partnerModel = makePartnerModel();
            (service as any)._partnerModel = partnerModel;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error).toBeUndefined();
            expect(partnerModel.findById).not.toHaveBeenCalled();
            expect(partnerModel.update).not.toHaveBeenCalled();
        });

        // The two link columns are INDEPENDENT, so one lead can carry both. An
        // `else if` between the two backfills would silently drop whichever
        // came second, and nothing downstream would report it.
        it('should backfill BOTH links when one lead provisioned a listing and a partner', async () => {
            const service = makeService();
            const model = makeLeadModel(
                claimableLead({
                    provisionedHostTradeId: HOST_TRADE_ID,
                    provisionedPartnerId: PARTNER_ID
                })
            );
            (service as any)._model = model;
            const hostTradeModel = makeHostTradeModel({ id: HOST_TRADE_ID, ownerUserId: null });
            (service as any)._hostTradeModel = hostTradeModel;
            const partnerModel = makePartnerModel({ id: PARTNER_ID, ownerUserId: null });
            (service as any)._partnerModel = partnerModel;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error).toBeUndefined();

            const [htWhere, htData, htTx] = hostTradeModel.update.mock.calls[0] ?? [];
            const [pWhere, pData, pTx] = partnerModel.update.mock.calls[0] ?? [];

            expect(htWhere).toEqual({ id: HOST_TRADE_ID });
            expect(htData).toEqual(expect.objectContaining({ ownerUserId: ACTOR_ID }));
            expect(pWhere).toEqual({ id: PARTNER_ID });
            expect(pData).toEqual(expect.objectContaining({ ownerUserId: ACTOR_ID }));

            // Both writes enlist in the SAME boundary. That is the actual
            // guarantee: a failure between them must not leave the lead linked
            // with only one of its two rows backfilled.
            expect(htTx).toBeDefined();
            expect(pTx).toBe(htTx);
        });

        it('should burn the token so the same link cannot be replayed', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead());
            (service as any)._model = model;

            await service.claimLead({ actor: claimant, id: LEAD_ID, token: RAW_TOKEN });

            const payload = model.update.mock.calls[0]?.[1];
            expect(payload.claimToken).toBeNull();
            expect(payload.claimExpiresAt).toBeNull();
        });

        it('should reject a wrong token', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead());
            (service as any)._model = model;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: 'not-the-token'
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should reject an expired token', async () => {
            const service = makeService();
            const model = makeLeadModel(
                claimableLead({ claimExpiresAt: new Date(Date.now() - 1000) })
            );
            (service as any)._model = model;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should reject a VALID token presented by a different mailbox (forwarded link)', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead());
            (service as any)._model = model;

            const result = await service.claimLead({
                actor: { ...claimant, id: 'other-user-id', email: 'someone.else@example.com' },
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should match the owner email case-insensitively', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead());
            (service as any)._model = model;

            const result = await service.claimLead({
                actor: { ...claimant, email: '  JUAN@Example.COM ' },
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error).toBeUndefined();
            expect(model.update).toHaveBeenCalled();
        });

        it('should reject an anonymous actor', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead());
            (service as any)._model = model;

            const result = await service.claimLead({
                actor: { ...guestActor, email: 'juan@example.com' },
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should reject an actor with no email on the session', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead());
            (service as any)._model = model;

            const result = await service.claimLead({
                actor: { id: ACTOR_ID, roles: [RoleEnum.USER], permissions: [] },
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should answer idempotently when the SAME account already holds the lead', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead({ applicantUserId: ACTOR_ID }));
            (service as any)._model = model;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error).toBeUndefined();
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should reject a claim on a lead already linked to someone else', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead({ applicantUserId: 'another-user-id' }));
            (service as any)._model = model;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should reject a soft-deleted lead', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead({ deletedAt: new Date() }));
            (service as any)._model = model;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should reject a lead that never had a claim issued', async () => {
            const service = makeService();
            const model = makeLeadModel(claimableLead({ claimToken: null, claimExpiresAt: null }));
            (service as any)._model = model;

            const result = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: RAW_TOKEN
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should give the SAME error for every rejection reason (no oracle)', async () => {
            const service = makeService();
            const reasons = [
                claimableLead({ claimExpiresAt: new Date(Date.now() - 1000) }),
                claimableLead({ applicantUserId: 'another-user-id' }),
                claimableLead({ claimToken: null, claimExpiresAt: null })
            ];

            const errors: (string | undefined)[] = [];
            for (const lead of reasons) {
                (service as any)._model = makeLeadModel(lead);
                const result = await service.claimLead({
                    actor: claimant,
                    id: LEAD_ID,
                    token: RAW_TOKEN
                });
                errors.push(result.error?.message);
            }
            // Wrong token, on an otherwise perfectly valid lead.
            (service as any)._model = makeLeadModel(claimableLead());
            const wrongToken = await service.claimLead({
                actor: claimant,
                id: LEAD_ID,
                token: 'nope'
            });
            errors.push(wrongToken.error?.message);

            expect(new Set(errors).size).toBe(1);
            expect(errors[0]).toBeDefined();
        });

        it('should return VALIDATION_ERROR for a non-UUID lead id', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel(claimableLead());

            const result = await service.claimLead({
                actor: claimant,
                id: 'not-a-uuid',
                token: RAW_TOKEN
            });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });

        it('should return VALIDATION_ERROR for an empty token', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel(claimableLead());

            const result = await service.claimLead({ actor: claimant, id: LEAD_ID, token: '' });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    describe('listMine', () => {
        it('should scope the read to the caller and return their leads (AC-5)', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            const result = await service.listMine({ actor: authenticatedActor });

            expect(result.error).toBeUndefined();
            expect(result.data).toEqual([mockLead]);
            expect(model.findAll).toHaveBeenCalledWith(
                { deletedAt: null, applicantUserId: ACTOR_ID },
                expect.objectContaining({ sortBy: 'createdAt', sortOrder: 'desc' }),
                undefined,
                undefined
            );
        });

        it('should require no permission (self-service read)', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            // `authenticatedActor` holds zero permissions.
            const result = await service.listMine({ actor: authenticatedActor });

            expect(result.error).toBeUndefined();
        });

        it('should return [] for an anonymous actor WITHOUT querying (never an unscoped read)', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            const result = await service.listMine({ actor: guestActor });

            expect(result.error).toBeUndefined();
            expect(result.data).toEqual([]);
            expect(model.findAll).not.toHaveBeenCalled();
        });

        it('should return [] (not NOT_FOUND) when the caller has never applied (AC-5)', async () => {
            const service = makeService();
            const model = makeLeadModel();
            model.findAll.mockResolvedValue({ items: [], total: 0 });
            (service as any)._model = model;

            const result = await service.listMine({ actor: authenticatedActor });

            expect(result.error).toBeUndefined();
            expect(result.data).toEqual([]);
        });

        it('should exclude soft-deleted leads', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            await service.listMine({ actor: authenticatedActor });

            expect(model.findAll).toHaveBeenCalledWith(
                expect.objectContaining({ deletedAt: null }),
                expect.any(Object),
                undefined,
                undefined
            );
        });
    });

    describe('listForAdmin', () => {
        it('should return leads for admin actor', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            const result = await service.listForAdmin({ actor: adminActor, query: {} });

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
        });

        it('should return FORBIDDEN for actor without ALLIANCE_LEAD_VIEW_ALL', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.listForAdmin({ actor: guestActor, query: {} });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should pass kind + status filters to model.findAll', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            await service.listForAdmin({
                actor: adminActor,
                query: { kind: 'sponsor', status: 'pending' }
            });

            expect(model.findAll).toHaveBeenCalledWith(
                expect.objectContaining({ kind: 'sponsor', status: 'pending' }),
                expect.any(Object),
                undefined,
                undefined
            );
        });

        it('should filter out soft-deleted leads (deletedAt: null) from the admin list', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            await service.listForAdmin({ actor: adminActor, query: {} });

            expect(model.findAll).toHaveBeenCalledWith(
                expect.objectContaining({ deletedAt: null }),
                expect.any(Object),
                undefined,
                undefined
            );
        });
    });

    describe('markHandled', () => {
        it('should approve a lead for admin actor', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            const result = await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'approved', adminNote: 'Looks good' }
            });

            expect(result.error).toBeUndefined();
            expect(model.update).toHaveBeenCalledWith(
                { id: LEAD_ID },
                expect.objectContaining({
                    status: 'approved',
                    adminNote: 'Looks good',
                    updatedById: ACTOR_ID
                }),
                undefined
            );
        });

        // HOS-278 AC-6 — the applicant hears the outcome, either way.
        it('should notify the applicant when a lead is approved (AC-6)', async () => {
            const notifyDecision = vi.fn().mockResolvedValue(undefined);
            const service = new AllianceLeadService({ logger: undefined }, null, {
                notifyDecision
            });
            (service as any)._model = makeLeadModel();

            await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'approved' }
            });

            expect(notifyDecision).toHaveBeenCalledWith(
                expect.objectContaining({
                    leadId: LEAD_ID,
                    email: 'juan@example.com',
                    kind: 'partner',
                    outcome: 'approved'
                })
            );
        });

        it('should notify the applicant when a lead is REJECTED too (AC-6)', async () => {
            const notifyDecision = vi.fn().mockResolvedValue(undefined);
            const service = new AllianceLeadService({ logger: undefined }, null, {
                notifyDecision
            });
            const model = makeLeadModel();
            model.update.mockResolvedValue({ ...mockLead, status: 'rejected' });
            (service as any)._model = model;

            await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'rejected' }
            });

            expect(notifyDecision).toHaveBeenCalledWith(
                expect.objectContaining({ outcome: 'rejected' })
            );
        });

        it('should never hand the admin note to the notifier', async () => {
            const notifyDecision = vi.fn().mockResolvedValue(undefined);
            const service = new AllianceLeadService({ logger: undefined }, null, {
                notifyDecision
            });
            (service as any)._model = makeLeadModel();

            await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'rejected', adminNote: 'Internal: not a good fit' }
            });

            const sent = notifyDecision.mock.calls[0]?.[0];
            expect(JSON.stringify(sent)).not.toContain('not a good fit');
        });

        it('should still persist the decision when the notification fails', async () => {
            const notifyDecision = vi.fn().mockRejectedValue(new Error('SMTP down'));
            const service = new AllianceLeadService({ logger: undefined }, null, {
                notifyDecision
            });
            const model = makeLeadModel();
            (service as any)._model = model;

            const result = await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'approved' }
            });

            expect(result.error).toBeUndefined();
            expect(model.update).toHaveBeenCalled();
        });

        it('should not notify when the lead does not exist', async () => {
            const notifyDecision = vi.fn().mockResolvedValue(undefined);
            const service = new AllianceLeadService({ logger: undefined }, null, {
                notifyDecision
            });
            const model = makeLeadModel();
            model.findById.mockResolvedValue(null);
            (service as any)._model = model;

            const result = await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'approved' }
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(notifyDecision).not.toHaveBeenCalled();
        });

        it('should not notify when the actor lacks ALLIANCE_LEAD_MANAGE', async () => {
            const notifyDecision = vi.fn().mockResolvedValue(undefined);
            const service = new AllianceLeadService({ logger: undefined }, null, {
                notifyDecision
            });
            (service as any)._model = makeLeadModel();

            await service.markHandled({
                actor: guestActor,
                id: LEAD_ID,
                input: { status: 'approved' }
            });

            expect(notifyDecision).not.toHaveBeenCalled();
        });

        it('should work with no notifier injected at all', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'approved' }
            });

            expect(result.error).toBeUndefined();
        });

        it('should return FORBIDDEN for actor without ALLIANCE_LEAD_MANAGE', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.markHandled({
                actor: guestActor,
                id: LEAD_ID,
                input: { status: 'rejected' }
            });

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should return NOT_FOUND when lead does not exist', async () => {
            const service = makeService();
            const model = makeLeadModel();
            model.findById.mockResolvedValue(null);
            (service as any)._model = model;

            const result = await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'approved' }
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should return VALIDATION_ERROR for non-UUID id', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.markHandled({
                actor: adminActor,
                id: 'not-a-uuid',
                input: { status: 'approved' }
            });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });

        it('should return VALIDATION_ERROR for a non-terminal status (pending/reviewing)', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'reviewing' as any }
            });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    // HOS-599 regression — the F-52 smoke finding: a `service_provider` lead's
    // `host_trades` listing is provisioned ownerless at approval, and nothing
    // in the codebase ever invited the applicant to claim it. `createLead`'s
    // own claim invite is gated on the address already having an account
    // (AC-3), which for a fresh provider signup (the ordinary case per
    // HOS-647) is practically always false — making that call site
    // functionally dead for this population, even though it IS reachable.
    // This suite pins the fix: `markHandled` must mint a fresh token and fire
    // the injected `claimInviter` unconditionally when it approves an
    // unclaimed `service_provider` lead.
    describe('markHandled — claim invite on approval (HOS-599)', () => {
        it('should mint a fresh claim token and invite the applicant when approving a first-time, unclaimed service_provider lead', async () => {
            const inviteToClaim = vi.fn().mockResolvedValue(undefined);
            const service = new AllianceLeadService({ logger: undefined }, { inviteToClaim });
            const model = makeLeadModel(providerLead());
            model.update.mockResolvedValue({
                ...providerLead(),
                status: 'approved',
                provisionedHostTradeId: HOST_TRADE_ID
            });
            (service as any)._model = model;
            (service as any)._hostTradeModel = makeProvisioningHostTradeModel();

            const result = await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'approved' }
            });

            expect(result.error).toBeUndefined();
            expect(inviteToClaim).toHaveBeenCalledOnce();
            const invited = inviteToClaim.mock.calls[0]?.[0];
            expect(invited).toMatchObject({
                leadId: LEAD_ID,
                email: 'juan@example.com',
                contactName: 'Juan Pérez',
                kind: 'service_provider'
            });
            expect(typeof invited.token).toBe('string');
            expect(invited.token.length).toBeGreaterThan(0);
            expect(invited.expiresAt.getTime()).toBeGreaterThan(Date.now());
        });

        it('should persist a digest of the SAME token handed to the invite port, never the raw value', async () => {
            const inviteToClaim = vi.fn().mockResolvedValue(undefined);
            const service = new AllianceLeadService({ logger: undefined }, { inviteToClaim });
            const model = makeLeadModel(providerLead());
            model.update.mockResolvedValue({
                ...providerLead(),
                status: 'approved',
                provisionedHostTradeId: HOST_TRADE_ID
            });
            (service as any)._model = model;
            (service as any)._hostTradeModel = makeProvisioningHostTradeModel();

            await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'approved' }
            });

            const rawToken = inviteToClaim.mock.calls[0]?.[0].token as string;
            const persisted = model.update.mock.calls[0]?.[1] as Record<string, unknown>;
            expect(persisted.claimToken).not.toBe(rawToken);
            expect(persisted.claimToken).toBe(
                createHash('sha256').update(rawToken, 'utf8').digest('hex')
            );
            expect(persisted.claimExpiresAt).toBeInstanceOf(Date);
        });

        it('should re-invite when re-approving an idempotent, already-provisioned lead that is STILL unclaimed', async () => {
            const inviteToClaim = vi.fn().mockResolvedValue(undefined);
            const service = new AllianceLeadService({ logger: undefined }, { inviteToClaim });
            const alreadyProvisioned = providerLead({
                status: 'approved',
                provisionedHostTradeId: HOST_TRADE_ID
            });
            const model = makeLeadModel(alreadyProvisioned);
            model.update.mockResolvedValue({ ...alreadyProvisioned, status: 'approved' });
            (service as any)._model = model;
            // No host-trade model call is expected on the skip path — a bare
            // object with no methods would fail loudly if provisioning were
            // (incorrectly) attempted again.
            (service as any)._hostTradeModel = {};

            const result = await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'approved' }
            });

            expect(result.error).toBeUndefined();
            expect(inviteToClaim).toHaveBeenCalledOnce();
        });

        it('should NOT invite when the lead is already claimed (applicantUserId set)', async () => {
            const inviteToClaim = vi.fn().mockResolvedValue(undefined);
            const service = new AllianceLeadService({ logger: undefined }, { inviteToClaim });
            const claimed = providerLead({
                applicantUserId: ACTOR_ID,
                provisionedHostTradeId: HOST_TRADE_ID
            });
            const model = makeLeadModel(claimed);
            model.update.mockResolvedValue({ ...claimed, status: 'approved' });
            (service as any)._model = model;
            (service as any)._hostTradeModel = {};

            await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'approved' }
            });

            expect(inviteToClaim).not.toHaveBeenCalled();
        });

        it('should NOT invite for a non-service_provider kind (e.g. partner)', async () => {
            const inviteToClaim = vi.fn().mockResolvedValue(undefined);
            const service = new AllianceLeadService({ logger: undefined }, { inviteToClaim });
            (service as any)._model = makeLeadModel();

            await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'approved' }
            });

            expect(inviteToClaim).not.toHaveBeenCalled();
        });

        it('should NOT invite on rejection', async () => {
            const inviteToClaim = vi.fn().mockResolvedValue(undefined);
            const service = new AllianceLeadService({ logger: undefined }, { inviteToClaim });
            const model = makeLeadModel(providerLead());
            model.update.mockResolvedValue({ ...providerLead(), status: 'rejected' });
            (service as any)._model = model;
            (service as any)._hostTradeModel = {};

            await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'rejected' }
            });

            expect(inviteToClaim).not.toHaveBeenCalled();
        });

        it('should still persist the approval when the claim invitation fails to send', async () => {
            const inviteToClaim = vi.fn().mockRejectedValue(new Error('SMTP down'));
            const service = new AllianceLeadService({ logger: undefined }, { inviteToClaim });
            const alreadyProvisioned = providerLead({
                status: 'approved',
                provisionedHostTradeId: HOST_TRADE_ID
            });
            const model = makeLeadModel(alreadyProvisioned);
            model.update.mockResolvedValue({ ...alreadyProvisioned, status: 'approved' });
            (service as any)._model = model;
            (service as any)._hostTradeModel = {};

            const result = await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'approved' }
            });

            expect(result.error).toBeUndefined();
            expect(model.update).toHaveBeenCalled();
        });

        it('should work with no claim-invite port injected at all', async () => {
            const service = makeService();
            const alreadyProvisioned = providerLead({
                status: 'approved',
                provisionedHostTradeId: HOST_TRADE_ID
            });
            const model = makeLeadModel(alreadyProvisioned);
            model.update.mockResolvedValue({ ...alreadyProvisioned, status: 'approved' });
            (service as any)._model = model;
            (service as any)._hostTradeModel = {};

            const result = await service.markHandled({
                actor: adminActor,
                id: LEAD_ID,
                input: { status: 'approved' }
            });

            expect(result.error).toBeUndefined();
        });
    });
});
