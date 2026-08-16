/**
 * commerce-owner-provisioning.service.test.ts
 *
 * Unit tests for CommerceOwnerProvisioningService (SPEC-239 T-040).
 * Better Auth interactions are mocked via the CreateUserPort.
 *
 * ## HOS-296 rewrite (§12)
 *
 * The port is now resolve-or-create, not create: an email that already belongs
 * to an account is GRANTED the commerce hat instead of colliding on signup and
 * leaving the lead permanently stuck (G-4 / AC-4). That turned
 * `CreateUserPortResult.alreadyExisted` into part of the contract, and it
 * changes what this service does downstream — the credential email is skipped
 * and `temporaryPassword` comes back `null`, because the pre-existing account
 * kept its own password and was never given the generated one.
 *
 * The old suite could not express any of that: every case implicitly assumed
 * "a new account was created", and `temporaryPassword` was asserted as always
 * present.
 */

import type { CommerceLead } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
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
const EXISTING_USER_ID = 'user-already-registered-001';

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
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.COMMERCE_EDIT_ALL]
};

const guestActor: Actor = {
    id: 'guest-001',
    roles: [RoleEnum.GUEST],
    permissions: []
};

// ---------------------------------------------------------------------------
// Port factories
// ---------------------------------------------------------------------------

/** Port stub for the "email was free, account created" path. */
function makeCreateUserPort(
    result = {
        id: USER_ID,
        email: mockLead.email,
        name: mockLead.contactName,
        alreadyExisted: false
    }
): CreateUserPort {
    return vi.fn().mockResolvedValue(result) as unknown as CreateUserPort;
}

/** Port stub for the "email already belonged to an account" path (AC-4). */
function makeExistingUserPort(): CreateUserPort {
    return makeCreateUserPort({
        id: EXISTING_USER_ID,
        email: mockLead.email,
        name: 'Juana Existente',
        alreadyExisted: true
    });
}

/**
 * Port stub for a credentials email that WAS delivered.
 *
 * The port reports delivery now (H-87 / H-150): the admin repeats its outcome
 * to the applicant as "las credenciales fueron enviadas", so resolving is not
 * the same claim as arriving.
 */
function makeNotificationPort(delivered = true): ProvisioningNotificationPort {
    return {
        notifyOwnerCredentials: vi.fn().mockResolvedValue({ delivered })
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
        // ── H-87 / H-150 ────────────────────────────────────────────────
        // The admin told the operator "cuenta creada, credenciales enviadas"
        // in every case, including the one where neither happened. The service
        // now reports the fact, and these are the three ways it can be false.
        describe('reports whether credentials actually went out', () => {
            it('true when the notifier confirms delivery', async () => {
                const service = makeService(makeCreateUserPort(), makeNotificationPort(true));

                const result = await service.provisionCommerceOwner(adminActor, {
                    lead: mockLead
                });

                expect(result.data?.credentialsSent).toBe(true);
                expect(result.data?.alreadyExisted).toBe(false);
            });

            it('false when the transport reports it did not send', async () => {
                const service = makeService(makeCreateUserPort(), makeNotificationPort(false));

                const result = await service.provisionCommerceOwner(adminActor, {
                    lead: mockLead
                });

                // The account is still worth keeping — provisioning must not
                // abort over a mail server. What must not survive is the claim.
                expect(result.error).toBeUndefined();
                expect(result.data?.userId).toBe(USER_ID);
                expect(result.data?.credentialsSent).toBe(false);
            });

            it('false when the transport throws', async () => {
                const service = makeService(makeCreateUserPort(), {
                    notifyOwnerCredentials: vi.fn().mockRejectedValue(new Error('smtp down'))
                });

                const result = await service.provisionCommerceOwner(adminActor, {
                    lead: mockLead
                });

                expect(result.error).toBeUndefined();
                expect(result.data?.credentialsSent).toBe(false);
            });

            it('false when no notifier is configured at all', async () => {
                const service = makeService(makeCreateUserPort(), null);

                const result = await service.provisionCommerceOwner(adminActor, {
                    lead: mockLead
                });

                expect(result.data?.credentialsSent).toBe(false);
            });

            it('false for an email that already had an account, which is owed no email', async () => {
                const service = makeService(makeExistingUserPort(), makeNotificationPort(true));

                const result = await service.provisionCommerceOwner(adminActor, {
                    lead: mockLead
                });

                expect(result.data?.alreadyExisted).toBe(true);
                expect(result.data?.credentialsSent).toBe(false);
            });
        });

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

        it('should include temporaryPassword in the result when the account was created', async () => {
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

        it('returns the existing user and skips the credential email when the email is already registered', async () => {
            // AC-4: this is the case that used to blow up with a duplicate-email
            // INTERNAL_ERROR and leave the lead pending with no way out.
            const notifier = makeNotificationPort();
            const service = makeService(makeExistingUserPort(), notifier);

            const result = await service.provisionCommerceOwner(adminActor, { lead: mockLead });

            expect(result.error).toBeUndefined();
            expect(result.data?.userId).toBe(EXISTING_USER_ID);
            expect(result.data?.alreadyExisted).toBe(true);

            // The generated password was never applied to that account, so
            // mailing it would hand the owner credentials that do not work.
            expect(result.data?.temporaryPassword).toBeNull();
            expect(notifier.notifyOwnerCredentials).not.toHaveBeenCalled();
        });

        it('reports alreadyExisted=false when it created the account', async () => {
            const service = makeService();

            const result = await service.provisionCommerceOwner(adminActor, { lead: mockLead });

            expect(result.data?.alreadyExisted).toBe(false);
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
