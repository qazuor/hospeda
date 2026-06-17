/**
 * commerce-lead.service.test.ts
 *
 * Unit tests for CommerceLeadService (SPEC-239 T-033).
 * All DB and notification interactions are mocked.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceLeadService } from '../../../src/services/commerce/commerce-lead.service';
import type { LeadNotificationPort } from '../../../src/services/commerce/commerce-lead.service';
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
    permissions: [PermissionEnum.COMMERCE_VIEW_ALL, PermissionEnum.COMMERCE_EDIT_ALL]
};

const guestActor: Actor = {
    id: GUEST_ID,
    role: RoleEnum.GUEST,
    permissions: []
};

const createInput = {
    domain: 'gastronomy',
    businessName: 'La Parrilla de Juan',
    contactName: 'Juan Pérez',
    email: 'juan@example.com',
    phone: '+5491112345678',
    message: 'Me gustaría sumar mi parrilla al directorio gastronómico'
};

const mockLead = {
    id: LEAD_ID,
    ...createInput,
    status: 'pending' as const,
    handledAt: null,
    handledById: null,
    adminNote: null,
    destinationId: null,
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

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

function makeService(notifier?: LeadNotificationPort | null) {
    const service = new CommerceLeadService({ logger: undefined }, notifier);
    return service;
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

describe('CommerceLeadService', () => {
    describe('createLead', () => {
        it('should create a lead and return it', async () => {
            const service = makeService();
            // Patch the internal model
            (service as any)._model = makeLeadModel();

            const result = await service.createLead(guestActor, createInput);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.domain).toBe('gastronomy');
            expect(result.data?.email).toBe('juan@example.com');
        });

        it('should call notifyNewLead when notifier is provided', async () => {
            const notifyNewLead = vi.fn().mockResolvedValue(undefined);
            const service = makeService({ notifyNewLead });
            (service as any)._model = makeLeadModel();

            await service.createLead(guestActor, createInput);

            expect(notifyNewLead).toHaveBeenCalledWith(expect.objectContaining({ id: LEAD_ID }));
        });

        it('should not throw when notifier fails (best-effort)', async () => {
            const notifyNewLead = vi.fn().mockRejectedValue(new Error('SMTP down'));
            const service = makeService({ notifyNewLead });
            (service as any)._model = makeLeadModel();

            // Should NOT throw even when notifier fails
            const result = await service.createLead(guestActor, createInput);
            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
        });

        it('should skip notification when no notifier is configured', async () => {
            const service = makeService(null);
            (service as any)._model = makeLeadModel();

            // Should complete without error even without notifier
            const result = await service.createLead(guestActor, createInput);
            expect(result.error).toBeUndefined();
        });

        it('should return VALIDATION_ERROR for invalid email', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.createLead(guestActor, {
                ...createInput,
                email: 'not-an-email'
            });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    describe('listLeads', () => {
        it('should return leads for admin actor', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            const result = await service.listLeads(adminActor);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
        });

        it('should return FORBIDDEN for actor without COMMERCE_VIEW_ALL', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.listLeads(guestActor);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should pass status filter to model.findAll', async () => {
            const service = makeService();
            const model = makeLeadModel();
            (service as any)._model = model;

            await service.listLeads(adminActor, { status: 'pending' });

            // The model.findAll call should have received a where clause with status
            expect(model.findAll).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'pending' }),
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

            const result = await service.markHandled(adminActor, {
                id: LEAD_ID,
                status: 'approved',
                handledById: ACTOR_ID,
                adminNote: 'Looks good'
            });

            expect(result.error).toBeUndefined();
            expect(model.update).toHaveBeenCalled();
        });

        it('should return FORBIDDEN for actor without COMMERCE_EDIT_ALL', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.markHandled(guestActor, {
                id: LEAD_ID,
                status: 'rejected',
                handledById: GUEST_ID
            });

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should return NOT_FOUND when lead does not exist', async () => {
            const service = makeService();
            const model = makeLeadModel();
            model.findById.mockResolvedValue(null);
            (service as any)._model = model;

            const result = await service.markHandled(adminActor, {
                id: LEAD_ID,
                status: 'approved',
                handledById: ACTOR_ID
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should return VALIDATION_ERROR for non-UUID id', async () => {
            const service = makeService();
            (service as any)._model = makeLeadModel();

            const result = await service.markHandled(adminActor, {
                id: 'not-a-uuid',
                status: 'approved',
                handledById: ACTOR_ID
            });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });
});
