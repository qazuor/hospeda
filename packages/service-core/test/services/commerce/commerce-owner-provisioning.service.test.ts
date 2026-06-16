/**
 * commerce-owner-provisioning.service.test.ts
 *
 * Unit tests for CommerceOwnerProvisioningService (SPEC-239 T-040).
 * Better Auth interactions are mocked via the CreateUserPort.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { CommerceLead } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CommerceOwnerProvisioningService,
    type CreateUserPort,
    type ProvisioningNotificationPort
} from '../../../src/services/commerce/commerce-owner-provisioning.service';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LEAD_ID = '00000000-0000-4000-a000-000000000003';
const USER_ID = 'user-provisioned-001';

const mockLead: CommerceLead = {
    id: LEAD_ID,
    domain: 'gastronomy',
    businessName: 'La Parrilla de Juan',
    contactName: 'Juan Pérez',
    email: 'juan@example.com',
    phone: '+5491112345678',
    message: 'Quiero listar mi parrilla',
    destinationId: null,
    status: 'approved',
    handledAt: new Date(),
    handledById: 'admin-001',
    adminNote: 'Approved',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};

const adminActor: Actor = {
    id: 'admin-001',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.COMMERCE_EDIT_ALL]
};

const guestActor: Actor = {
    id: 'guest-001',
    role: RoleEnum.GUEST,
    permissions: []
};

// ---------------------------------------------------------------------------
// Port factories
// ---------------------------------------------------------------------------

function makeCreateUserPort(
    result = { id: USER_ID, email: mockLead.email, name: mockLead.contactName }
): CreateUserPort {
    return vi.fn().mockResolvedValue(result) as unknown as CreateUserPort;
}

function makeNotificationPort(): ProvisioningNotificationPort {
    return {
        notifyOwnerCredentials: vi.fn().mockResolvedValue(undefined)
    };
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

function makeService(
    createUserPort: CreateUserPort = makeCreateUserPort(),
    notifier?: ProvisioningNotificationPort | null
) {
    return new CommerceOwnerProvisioningService({ logger: undefined }, createUserPort, notifier);
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

describe('CommerceOwnerProvisioningService', () => {
    describe('provisionCommerceOwner', () => {
        it('should create a user via the CreateUserPort', async () => {
            const createUserPort = makeCreateUserPort();
            const service = makeService(createUserPort);

            const result = await service.provisionCommerceOwner(adminActor, { lead: mockLead });

            expect(result.error).toBeUndefined();
            expect(result.data?.userId).toBe(USER_ID);
            expect(result.data?.email).toBe(mockLead.email);
            expect(result.data?.name).toBe(mockLead.contactName);
        });

        it('should call CreateUserPort with COMMERCE_OWNER role and mustChangePassword=true', async () => {
            const createUserPort = makeCreateUserPort();
            const service = makeService(createUserPort);

            await service.provisionCommerceOwner(adminActor, { lead: mockLead });

            expect(createUserPort).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: mockLead.email,
                    name: mockLead.contactName,
                    role: RoleEnum.COMMERCE_OWNER,
                    mustChangePassword: true
                })
            );
        });

        it('should include temporaryPassword in the result', async () => {
            const service = makeService();

            const result = await service.provisionCommerceOwner(adminActor, { lead: mockLead });

            expect(result.data?.temporaryPassword).toBeDefined();
            // Temporary password should be non-trivial length (base64url 18 bytes → 24 chars)
            expect(result.data?.temporaryPassword?.length).toBeGreaterThanOrEqual(16);
        });

        it('should call notifyOwnerCredentials when notifier is provided', async () => {
            const notifier = makeNotificationPort();
            const service = makeService(makeCreateUserPort(), notifier);

            await service.provisionCommerceOwner(adminActor, { lead: mockLead });

            expect(notifier.notifyOwnerCredentials).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: mockLead.email,
                    name: mockLead.contactName,
                    leadId: LEAD_ID
                })
            );
        });

        it('should not throw when notifier fails (best-effort)', async () => {
            const notifier: ProvisioningNotificationPort = {
                notifyOwnerCredentials: vi.fn().mockRejectedValue(new Error('Email down'))
            };
            const service = makeService(makeCreateUserPort(), notifier);

            const result = await service.provisionCommerceOwner(adminActor, { lead: mockLead });

            // Provisioning must succeed even when notification fails
            expect(result.error).toBeUndefined();
            expect(result.data?.userId).toBe(USER_ID);
        });

        it('should complete without notification when no notifier is configured', async () => {
            const service = makeService(makeCreateUserPort(), null);

            const result = await service.provisionCommerceOwner(adminActor, { lead: mockLead });

            expect(result.error).toBeUndefined();
            expect(result.data?.userId).toBe(USER_ID);
        });

        it('should return FORBIDDEN for actor without COMMERCE_EDIT_ALL', async () => {
            const service = makeService();

            const result = await service.provisionCommerceOwner(guestActor, { lead: mockLead });

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should return INTERNAL_ERROR when CreateUserPort rejects', async () => {
            const failingPort: CreateUserPort = vi
                .fn()
                .mockRejectedValue(
                    new Error('Auth service unavailable')
                ) as unknown as CreateUserPort;
            const service = makeService(failingPort);

            const result = await service.provisionCommerceOwner(adminActor, { lead: mockLead });

            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toContain('Auth service unavailable');
        });

        it('should generate a different temporary password on each call', async () => {
            const service = makeService();

            const [r1, r2] = await Promise.all([
                service.provisionCommerceOwner(adminActor, { lead: mockLead }),
                service.provisionCommerceOwner(adminActor, { lead: mockLead })
            ]);

            expect(r1.data?.temporaryPassword).not.toBe(r2.data?.temporaryPassword);
        });
    });
});
