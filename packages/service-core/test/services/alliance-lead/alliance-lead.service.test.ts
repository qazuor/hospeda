/**
 * alliance-lead.service.test.ts
 *
 * Unit tests for AllianceLeadService (HOS-277). All DB interactions are mocked.
 */

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
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.ALLIANCE_LEAD_VIEW_ALL, PermissionEnum.ALLIANCE_LEAD_MANAGE]
};

const guestActor: Actor = {
    id: GUEST_ID,
    role: RoleEnum.GUEST,
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
