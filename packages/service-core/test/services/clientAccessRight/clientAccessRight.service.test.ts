import type { ClientAccessRightModel } from '@repo/db';
import { AccessRightScopeEnum, type ClientAccessRight } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientAccessRightService } from '../../../src/services/clientAccessRight/clientAccessRight.service.js';
import type { Actor } from '../../../src/types/service-context.js';

describe('ClientAccessRightService', () => {
    let service: ClientAccessRightService;
    let mockModel: ClientAccessRightModel;
    let mockActor: Actor;
    let ctx: import('../../../src/types/service-context.js').ServiceContext;

    // Mock data
    const mockClientAccessRight: ClientAccessRight = {
        id: '00000000-0000-0000-0000-000000000001',
        clientId: '00000000-0000-0000-0000-000000000002',
        subscriptionItemId: '00000000-0000-0000-0000-000000000003',
        feature: 'FEATURED_LISTING',
        scope: AccessRightScopeEnum.ACCOMMODATION,
        scopeId: '00000000-0000-0000-0000-000000000004',
        scopeType: 'ACCOMMODATION',
        validFrom: new Date('2025-01-01'),
        validTo: new Date('2025-12-31'),
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        createdById: null,
        updatedById: null,
        deletedAt: null,
        deletedById: null,
        adminInfo: null
    };

    beforeEach(() => {
        ctx = {
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn()
            }
        } as unknown as import('../../../src/types/service-context.js').ServiceContext;

        mockActor = {
            id: '00000000-0000-0000-0000-000000000100',
            role: 'ADMIN',
            permissions: ['ACCESS_PERMISSIONS_MANAGE']
        };

        mockModel = {
            findByScope: vi.fn(),
            findByScopeType: vi.fn(),
            findActiveRights: vi.fn(),
            hasPermission: vi.fn(),
            findBySubscriptionItem: vi.fn(),
            findExpiring: vi.fn(),
            getActiveFeatures: vi.fn(),
            grantAccess: vi.fn(),
            revokeAccess: vi.fn(),
            findConflicts: vi.fn()
        } as unknown as ClientAccessRightModel;

        service = new ClientAccessRightService(ctx, mockModel);
    });

    // =========================================================================
    // findByScope
    // =========================================================================

    describe('findByScope', () => {
        it('should find access rights by scope', async () => {
            const scope: AccessRightScopeEnum = AccessRightScopeEnum.ACCOMMODATION;
            const mockRights: ClientAccessRight[] = [mockClientAccessRight];

            vi.mocked(mockModel.findByScope).mockResolvedValue(mockRights);

            const result = await service.findByScope(mockActor, scope);

            expect(result.data).toEqual(mockRights);
            expect(result.error).toBeUndefined();
            expect(mockModel.findByScope).toHaveBeenCalledWith(scope);
        });

        it('should return empty array when no rights found', async () => {
            const scope: AccessRightScopeEnum = AccessRightScopeEnum.GLOBAL;

            vi.mocked(mockModel.findByScope).mockResolvedValue([]);

            const result = await service.findByScope(mockActor, scope);

            expect(result.data).toEqual([]);
            expect(result.error).toBeUndefined();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: 'USER',
                permissions: []
            };

            const serviceWithoutPermission = new ClientAccessRightService(ctx, mockModel);

            const result = await serviceWithoutPermission.findByScope(
                actorWithoutPermission,
                'GLOBAL'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findByScopeType
    // =========================================================================

    describe('findByScopeType', () => {
        it('should find access rights by scope type', async () => {
            const scopeType = 'ACCOMMODATION';
            const mockRights: ClientAccessRight[] = [mockClientAccessRight];

            vi.mocked(mockModel.findByScopeType).mockResolvedValue(mockRights);

            const result = await service.findByScopeType(mockActor, scopeType);

            expect(result.data).toEqual(mockRights);
            expect(mockModel.findByScopeType).toHaveBeenCalledWith(scopeType);
        });

        it('should return empty array when no rights found', async () => {
            const scopeType = 'NONEXISTENT';

            vi.mocked(mockModel.findByScopeType).mockResolvedValue([]);

            const result = await service.findByScopeType(mockActor, scopeType);

            expect(result.data).toEqual([]);
            expect(result.error).toBeUndefined();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: 'USER',
                permissions: []
            };

            const serviceWithoutPermission = new ClientAccessRightService(ctx, mockModel);

            const result = await serviceWithoutPermission.findByScopeType(
                actorWithoutPermission,
                'ACCOMMODATION'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findActiveRights
    // =========================================================================

    describe('findActiveRights', () => {
        it('should find currently active access rights', async () => {
            const mockRights: ClientAccessRight[] = [mockClientAccessRight];

            vi.mocked(mockModel.findActiveRights).mockResolvedValue(mockRights);

            const result = await service.findActiveRights(mockActor);

            expect(result.data).toEqual(mockRights);
            expect(mockModel.findActiveRights).toHaveBeenCalled();
        });

        it('should return empty array when no active rights', async () => {
            vi.mocked(mockModel.findActiveRights).mockResolvedValue([]);

            const result = await service.findActiveRights(mockActor);

            expect(result.data).toEqual([]);
            expect(result.error).toBeUndefined();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: 'USER',
                permissions: []
            };

            const serviceWithoutPermission = new ClientAccessRightService(ctx, mockModel);

            const result = await serviceWithoutPermission.findActiveRights(actorWithoutPermission);

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // hasPermission
    // =========================================================================

    describe('hasPermission', () => {
        it('should check if client has permission', async () => {
            const clientId = '00000000-0000-0000-0000-000000000002';
            const feature = 'FEATURED_LISTING';
            const scope: AccessRightScopeEnum = AccessRightScopeEnum.ACCOMMODATION;
            const scopeId = '00000000-0000-0000-0000-000000000004';

            vi.mocked(mockModel.hasPermission).mockResolvedValue(true);

            const result = await service.hasPermission(
                mockActor,
                clientId,
                feature,
                scope,
                scopeId
            );

            expect(result.data).toBe(true);
            expect(mockModel.hasPermission).toHaveBeenCalledWith(clientId, feature, scope, scopeId);
        });

        it('should return false when client does not have permission', async () => {
            const clientId = '00000000-0000-0000-0000-000000000002';
            const feature = 'NONEXISTENT_FEATURE';
            const scope: AccessRightScopeEnum = AccessRightScopeEnum.GLOBAL;

            vi.mocked(mockModel.hasPermission).mockResolvedValue(false);

            const result = await service.hasPermission(mockActor, clientId, feature, scope);

            expect(result.data).toBe(false);
        });

        it('should work without scopeId for global scope', async () => {
            const clientId = '00000000-0000-0000-0000-000000000002';
            const feature = 'GLOBAL_FEATURE';
            const scope: AccessRightScopeEnum = AccessRightScopeEnum.GLOBAL;

            vi.mocked(mockModel.hasPermission).mockResolvedValue(true);

            const result = await service.hasPermission(mockActor, clientId, feature, scope);

            expect(result.data).toBe(true);
            expect(mockModel.hasPermission).toHaveBeenCalledWith(
                clientId,
                feature,
                scope,
                undefined
            );
        });
    });

    // =========================================================================
    // findBySubscriptionItem
    // =========================================================================

    describe('findBySubscriptionItem', () => {
        it('should find access rights by subscription item', async () => {
            const subscriptionItemId = '00000000-0000-0000-0000-000000000003';
            const mockRights: ClientAccessRight[] = [mockClientAccessRight];

            vi.mocked(mockModel.findBySubscriptionItem).mockResolvedValue(mockRights);

            const result = await service.findBySubscriptionItem(mockActor, subscriptionItemId);

            expect(result.data).toEqual(mockRights);
            expect(mockModel.findBySubscriptionItem).toHaveBeenCalledWith(subscriptionItemId);
        });

        it('should return empty array when no rights found', async () => {
            const subscriptionItemId = '00000000-0000-0000-0000-999999999999';

            vi.mocked(mockModel.findBySubscriptionItem).mockResolvedValue([]);

            const result = await service.findBySubscriptionItem(mockActor, subscriptionItemId);

            expect(result.data).toEqual([]);
            expect(result.error).toBeUndefined();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: 'USER',
                permissions: []
            };

            const serviceWithoutPermission = new ClientAccessRightService(ctx, mockModel);

            const result = await serviceWithoutPermission.findBySubscriptionItem(
                actorWithoutPermission,
                '00000000-0000-0000-0000-000000000003'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findExpiring
    // =========================================================================

    describe('findExpiring', () => {
        it('should find access rights expiring within specified days', async () => {
            const days = 30;
            const expiringRight: ClientAccessRight = {
                ...mockClientAccessRight,
                validTo: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days from now
            };

            vi.mocked(mockModel.findExpiring).mockResolvedValue([expiringRight]);

            const result = await service.findExpiring(mockActor, days);

            expect(result.data).toEqual([expiringRight]);
            expect(mockModel.findExpiring).toHaveBeenCalledWith(days);
        });

        it('should return empty array when no expiring rights', async () => {
            const days = 30;

            vi.mocked(mockModel.findExpiring).mockResolvedValue([]);

            const result = await service.findExpiring(mockActor, days);

            expect(result.data).toEqual([]);
            expect(result.error).toBeUndefined();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: 'USER',
                permissions: []
            };

            const serviceWithoutPermission = new ClientAccessRightService(ctx, mockModel);

            const result = await serviceWithoutPermission.findExpiring(actorWithoutPermission, 30);

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // getActiveFeatures
    // =========================================================================

    describe('getActiveFeatures', () => {
        it('should get active features for a client', async () => {
            const clientId = '00000000-0000-0000-0000-000000000002';
            const mockFeatures = ['FEATURED_LISTING', 'PREMIUM_PLACEMENT', 'ANALYTICS'];

            vi.mocked(mockModel.getActiveFeatures).mockResolvedValue(mockFeatures);

            const result = await service.getActiveFeatures(mockActor, clientId);

            expect(result.data).toEqual(mockFeatures);
            expect(mockModel.getActiveFeatures).toHaveBeenCalledWith(clientId);
        });

        it('should return empty array when client has no active features', async () => {
            const clientId = '00000000-0000-0000-0000-000000000002';

            vi.mocked(mockModel.getActiveFeatures).mockResolvedValue([]);

            const result = await service.getActiveFeatures(mockActor, clientId);

            expect(result.data).toEqual([]);
            expect(result.error).toBeUndefined();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: 'USER',
                permissions: []
            };

            const serviceWithoutPermission = new ClientAccessRightService(ctx, mockModel);

            const result = await serviceWithoutPermission.getActiveFeatures(
                actorWithoutPermission,
                '00000000-0000-0000-0000-000000000002'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // grantAccess
    // =========================================================================

    describe('grantAccess', () => {
        it('should grant access to a client', async () => {
            const input = {
                clientId: '00000000-0000-0000-0000-000000000002',
                subscriptionItemId: '00000000-0000-0000-0000-000000000003',
                feature: 'FEATURED_LISTING',
                scope: AccessRightScopeEnum.ACCOMMODATION,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                scopeId: '00000000-0000-0000-0000-000000000004',
                scopeType: 'ACCOMMODATION'
            };

            vi.mocked(mockModel.findConflicts).mockResolvedValue([]);
            vi.mocked(mockModel.grantAccess).mockResolvedValue(mockClientAccessRight);

            const result = await service.grantAccess(mockActor, input);

            expect(result.data).toEqual(mockClientAccessRight);
            expect(mockModel.findConflicts).toHaveBeenCalledWith(
                input.clientId,
                input.feature,
                input.scope,
                input.scopeId
            );
            expect(mockModel.grantAccess).toHaveBeenCalledWith(
                input.clientId,
                input.subscriptionItemId,
                input.feature,
                input.scope,
                input.validFrom,
                input.validTo,
                input.scopeId,
                input.scopeType
            );
        });

        it('should grant global access without scopeId', async () => {
            const input = {
                clientId: '00000000-0000-0000-0000-000000000002',
                subscriptionItemId: '00000000-0000-0000-0000-000000000003',
                feature: 'GLOBAL_FEATURE',
                scope: AccessRightScopeEnum.GLOBAL,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31')
            };

            const globalRight: ClientAccessRight = {
                ...mockClientAccessRight,
                scope: AccessRightScopeEnum.GLOBAL,
                scopeId: null,
                scopeType: null
            };

            vi.mocked(mockModel.findConflicts).mockResolvedValue([]);
            vi.mocked(mockModel.grantAccess).mockResolvedValue(globalRight);

            const result = await service.grantAccess(mockActor, input);

            expect(result.data).toEqual(globalRight);
        });

        it('should reject granting access when scopeId is missing for non-GLOBAL scope', async () => {
            const input = {
                clientId: '00000000-0000-0000-0000-000000000002',
                subscriptionItemId: '00000000-0000-0000-0000-000000000003',
                feature: 'FEATURED_LISTING',
                scope: AccessRightScopeEnum.ACCOMMODATION,
                validFrom: new Date('2025-01-01')
                // Missing scopeId
            };

            const result = await service.grantAccess(mockActor, input);

            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('scopeId is required');
        });

        it('should reject granting access when scopeType is missing for non-GLOBAL scope', async () => {
            const input = {
                clientId: '00000000-0000-0000-0000-000000000002',
                subscriptionItemId: '00000000-0000-0000-0000-000000000003',
                feature: 'FEATURED_LISTING',
                scope: AccessRightScopeEnum.ACCOMMODATION,
                validFrom: new Date('2025-01-01'),
                scopeId: '00000000-0000-0000-0000-000000000004'
                // Missing scopeType
            };

            const result = await service.grantAccess(mockActor, input);

            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('scopeType is required');
        });

        it('should reject granting access when validTo is before validFrom', async () => {
            const input = {
                clientId: '00000000-0000-0000-0000-000000000002',
                subscriptionItemId: '00000000-0000-0000-0000-000000000003',
                feature: 'FEATURED_LISTING',
                scope: AccessRightScopeEnum.ACCOMMODATION,
                validFrom: new Date('2025-12-31'),
                validTo: new Date('2025-01-01'), // Before validFrom
                scopeId: '00000000-0000-0000-0000-000000000004',
                scopeType: 'ACCOMMODATION'
            };

            const result = await service.grantAccess(mockActor, input);

            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('validTo must be after validFrom');
        });

        it('should reject granting access when conflicts exist', async () => {
            const input = {
                clientId: '00000000-0000-0000-0000-000000000002',
                subscriptionItemId: '00000000-0000-0000-0000-000000000003',
                feature: 'FEATURED_LISTING',
                scope: AccessRightScopeEnum.ACCOMMODATION,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                scopeId: '00000000-0000-0000-0000-000000000004',
                scopeType: 'ACCOMMODATION'
            };

            vi.mocked(mockModel.findConflicts).mockResolvedValue([mockClientAccessRight]);

            const result = await service.grantAccess(mockActor, input);

            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('Conflicting access right already exists');
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: 'USER',
                permissions: []
            };

            const serviceWithoutPermission = new ClientAccessRightService(ctx, mockModel);

            const input = {
                clientId: '00000000-0000-0000-0000-000000000002',
                subscriptionItemId: '00000000-0000-0000-0000-000000000003',
                feature: 'FEATURED_LISTING',
                scope: AccessRightScopeEnum.ACCOMMODATION,
                validFrom: new Date('2025-01-01'),
                scopeId: '00000000-0000-0000-0000-000000000004',
                scopeType: 'ACCOMMODATION'
            };

            const result = await serviceWithoutPermission.grantAccess(
                actorWithoutPermission,
                input
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // revokeAccess
    // =========================================================================

    describe('revokeAccess', () => {
        it('should revoke access for a client', async () => {
            const input = {
                clientId: '00000000-0000-0000-0000-000000000002',
                feature: 'FEATURED_LISTING',
                scope: AccessRightScopeEnum.ACCOMMODATION,
                scopeId: '00000000-0000-0000-0000-000000000004'
            };

            vi.mocked(mockModel.revokeAccess).mockResolvedValue(true);

            const result = await service.revokeAccess(mockActor, input);

            expect(result.data).toBe(true);
            expect(mockModel.revokeAccess).toHaveBeenCalledWith(
                input.clientId,
                input.feature,
                input.scope,
                input.scopeId
            );
        });

        it('should return error when no active access right found', async () => {
            const input = {
                clientId: '00000000-0000-0000-0000-000000000002',
                feature: 'NONEXISTENT_FEATURE',
                scope: 'GLOBAL' as AccessRightScopeEnum
            };

            vi.mocked(mockModel.revokeAccess).mockResolvedValue(false);

            const result = await service.revokeAccess(mockActor, input);

            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('No active access right found');
        });

        it('should revoke global access without scopeId', async () => {
            const input = {
                clientId: '00000000-0000-0000-0000-000000000002',
                feature: 'GLOBAL_FEATURE',
                scope: 'GLOBAL' as AccessRightScopeEnum
            };

            vi.mocked(mockModel.revokeAccess).mockResolvedValue(true);

            const result = await service.revokeAccess(mockActor, input);

            expect(result.data).toBe(true);
            expect(mockModel.revokeAccess).toHaveBeenCalledWith(
                input.clientId,
                input.feature,
                input.scope,
                undefined
            );
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: 'USER',
                permissions: []
            };

            const serviceWithoutPermission = new ClientAccessRightService(ctx, mockModel);

            const input = {
                clientId: '00000000-0000-0000-0000-000000000002',
                feature: 'FEATURED_LISTING',
                scope: AccessRightScopeEnum.ACCOMMODATION,
                scopeId: '00000000-0000-0000-0000-000000000004'
            };

            const result = await serviceWithoutPermission.revokeAccess(
                actorWithoutPermission,
                input
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findConflicts
    // =========================================================================

    describe('findConflicts', () => {
        it('should find conflicts for a potential access right', async () => {
            const input = {
                clientId: '00000000-0000-0000-0000-000000000002',
                feature: 'FEATURED_LISTING',
                scope: AccessRightScopeEnum.ACCOMMODATION,
                scopeId: '00000000-0000-0000-0000-000000000004'
            };

            const mockConflicts: ClientAccessRight[] = [mockClientAccessRight];

            vi.mocked(mockModel.findConflicts).mockResolvedValue(mockConflicts);

            const result = await service.findConflicts(mockActor, input);

            expect(result.data).toEqual(mockConflicts);
            expect(mockModel.findConflicts).toHaveBeenCalledWith(
                input.clientId,
                input.feature,
                input.scope,
                input.scopeId
            );
        });

        it('should return empty array when no conflicts', async () => {
            const input = {
                clientId: '00000000-0000-0000-0000-000000000002',
                feature: 'NEW_FEATURE',
                scope: 'GLOBAL' as AccessRightScopeEnum
            };

            vi.mocked(mockModel.findConflicts).mockResolvedValue([]);

            const result = await service.findConflicts(mockActor, input);

            expect(result.data).toEqual([]);
            expect(result.error).toBeUndefined();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: 'USER',
                permissions: []
            };

            const serviceWithoutPermission = new ClientAccessRightService(ctx, mockModel);

            const input = {
                clientId: '00000000-0000-0000-0000-000000000002',
                feature: 'FEATURED_LISTING',
                scope: AccessRightScopeEnum.ACCOMMODATION,
                scopeId: '00000000-0000-0000-0000-000000000004'
            };

            const result = await serviceWithoutPermission.findConflicts(
                actorWithoutPermission,
                input
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // batchGrantAccess
    // =========================================================================

    describe('batchGrantAccess', () => {
        it('should grant access to multiple clients', async () => {
            const inputs = [
                {
                    clientId: '00000000-0000-0000-0000-000000000002',
                    subscriptionItemId: '00000000-0000-0000-0000-000000000003',
                    feature: 'FEATURED_LISTING',
                    scope: AccessRightScopeEnum.ACCOMMODATION,
                    validFrom: new Date('2025-01-01'),
                    validTo: new Date('2025-12-31'),
                    scopeId: '00000000-0000-0000-0000-000000000004',
                    scopeType: 'ACCOMMODATION'
                },
                {
                    clientId: '00000000-0000-0000-0000-000000000005',
                    subscriptionItemId: '00000000-0000-0000-0000-000000000006',
                    feature: 'PREMIUM_PLACEMENT',
                    scope: AccessRightScopeEnum.GLOBAL,
                    validFrom: new Date('2025-01-01'),
                    validTo: new Date('2025-12-31')
                }
            ];

            const mockRight1: ClientAccessRight = { ...mockClientAccessRight, id: 'right-1' };
            const mockRight2: ClientAccessRight = {
                ...mockClientAccessRight,
                id: 'right-2',
                scope: 'GLOBAL'
            };

            vi.mocked(mockModel.findConflicts).mockResolvedValue([]);
            vi.mocked(mockModel.grantAccess)
                .mockResolvedValueOnce(mockRight1)
                .mockResolvedValueOnce(mockRight2);

            const result = await service.batchGrantAccess(mockActor, inputs);

            expect(result.data?.created).toHaveLength(2);
            expect(result.data?.errors).toHaveLength(0);
            expect(result.data?.created).toEqual([mockRight1, mockRight2]);
        });

        it('should handle partial failures in batch grant', async () => {
            const inputs = [
                {
                    clientId: '00000000-0000-0000-0000-000000000002',
                    subscriptionItemId: '00000000-0000-0000-0000-000000000003',
                    feature: 'FEATURED_LISTING',
                    scope: AccessRightScopeEnum.ACCOMMODATION,
                    validFrom: new Date('2025-01-01'),
                    scopeId: '00000000-0000-0000-0000-000000000004',
                    scopeType: 'ACCOMMODATION'
                },
                {
                    clientId: '00000000-0000-0000-0000-000000000005',
                    subscriptionItemId: '00000000-0000-0000-0000-000000000006',
                    feature: 'PREMIUM_PLACEMENT',
                    scope: AccessRightScopeEnum.ACCOMMODATION,
                    validFrom: new Date('2025-01-01')
                    // Missing scopeId - will fail validation
                }
            ];

            const mockRight1: ClientAccessRight = { ...mockClientAccessRight, id: 'right-1' };

            vi.mocked(mockModel.findConflicts).mockResolvedValue([]);
            vi.mocked(mockModel.grantAccess).mockResolvedValue(mockRight1);

            const result = await service.batchGrantAccess(mockActor, inputs);

            expect(result.data?.created).toHaveLength(1);
            expect(result.data?.errors).toHaveLength(1);
            expect(result.data?.errors?.[0]?.index).toBe(1);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: 'USER',
                permissions: []
            };

            const serviceWithoutPermission = new ClientAccessRightService(ctx, mockModel);

            const inputs = [
                {
                    clientId: '00000000-0000-0000-0000-000000000002',
                    subscriptionItemId: '00000000-0000-0000-0000-000000000003',
                    feature: 'FEATURED_LISTING',
                    scope: AccessRightScopeEnum.GLOBAL,
                    validFrom: new Date('2025-01-01')
                }
            ];

            const result = await serviceWithoutPermission.batchGrantAccess(
                actorWithoutPermission,
                inputs
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // batchRevokeAccess
    // =========================================================================

    describe('batchRevokeAccess', () => {
        it('should revoke access for multiple clients', async () => {
            const inputs = [
                {
                    clientId: '00000000-0000-0000-0000-000000000002',
                    feature: 'FEATURED_LISTING',
                    scope: AccessRightScopeEnum.ACCOMMODATION,
                    scopeId: '00000000-0000-0000-0000-000000000004'
                },
                {
                    clientId: '00000000-0000-0000-0000-000000000005',
                    feature: 'PREMIUM_PLACEMENT',
                    scope: 'GLOBAL' as AccessRightScopeEnum
                }
            ];

            vi.mocked(mockModel.revokeAccess).mockResolvedValue(true);

            const result = await service.batchRevokeAccess(mockActor, inputs);

            expect(result.data?.revoked).toBe(2);
            expect(result.data?.errors).toHaveLength(0);
        });

        it('should handle partial failures in batch revoke', async () => {
            const inputs = [
                {
                    clientId: '00000000-0000-0000-0000-000000000002',
                    feature: 'FEATURED_LISTING',
                    scope: AccessRightScopeEnum.ACCOMMODATION,
                    scopeId: '00000000-0000-0000-0000-000000000004'
                },
                {
                    clientId: '00000000-0000-0000-0000-000000000005',
                    feature: 'NONEXISTENT_FEATURE',
                    scope: 'GLOBAL' as AccessRightScopeEnum
                }
            ];

            vi.mocked(mockModel.revokeAccess)
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false);

            const result = await service.batchRevokeAccess(mockActor, inputs);

            expect(result.data?.revoked).toBe(1);
            expect(result.data?.errors).toHaveLength(1);
            expect(result.data?.errors?.[0]?.index).toBe(1);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: 'USER',
                permissions: []
            };

            const serviceWithoutPermission = new ClientAccessRightService(ctx, mockModel);

            const inputs = [
                {
                    clientId: '00000000-0000-0000-0000-000000000002',
                    feature: 'FEATURED_LISTING',
                    scope: 'GLOBAL' as AccessRightScopeEnum
                }
            ];

            const result = await serviceWithoutPermission.batchRevokeAccess(
                actorWithoutPermission,
                inputs
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });
});
