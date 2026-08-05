/**
 * alliance-lead.service.test.ts
 *
 * Unit tests for AllianceLeadService (HOS-277). All DB interactions are mocked.
 */

import { createHash } from 'node:crypto';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AllianceLeadService } from '../../../src/services/alliance-lead/alliance-lead.service';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LEAD_ID = '00000000-0000-4000-a000-000000000002';
const ACTOR_ID = '00000000-0000-4000-a000-000000000010';
const GUEST_ID = '00000000-0000-4000-a000-000000000011';

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
    message: 'Nombre del negocio: Acme SA\nSitio web: https://acme.com\n\nMensaje:\nQuiero sumarme.'
};

const mockLead = {
    id: LEAD_ID,
    ...createInput,
    status: 'pending' as string,
    adminNote: null,
    applicantUserId: null as string | null,
    claimToken: null as string | null,
    claimExpiresAt: null as Date | null,
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

function makeLeadModel(lead = mockLead) {
    return {
        create: vi.fn().mockResolvedValue(lead),
        findAll: vi.fn().mockResolvedValue({ items: [lead], total: 1 }),
        findById: vi.fn().mockResolvedValue(lead),
        update: vi.fn().mockResolvedValue({ ...lead, status: 'approved' })
    };
}

function makeService() {
    return new AllianceLeadService({ logger: undefined });
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
});
