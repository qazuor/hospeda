import { describe, expect, it } from 'vitest';
import {
    ClientDetailSchema,
    ClientOverviewSchema,
    ClientRelationConfigSchema,
    ClientWithAccessRightsSchema,
    ClientWithFullRelationsSchema,
    ClientWithSubscriptionsSchema,
    ClientWithUserSchema
} from '../../../src/entities/client/client.relations.schema.js';
import { LifecycleStatusEnum } from '../../../src/enums/lifecycle-state.enum.js';

describe('Client Relations Schemas', () => {
    // Base client data for testing
    const baseClientData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Client Corp',
        billingEmail: 'billing@testclient.com',
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        createdById: '550e8400-e29b-41d4-a716-446655440002',
        updatedById: '550e8400-e29b-41d4-a716-446655440002',
        deletedAt: undefined,
        deletedById: undefined,
        adminInfo: null
    };

    const sampleUser = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'user@testclient.com',
        displayName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        role: 'CLIENT_ADMIN',
        isActive: true
    };

    const sampleSubscription = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        planId: '550e8400-e29b-41d4-a716-446655440004',
        planName: 'Premium Plan',
        status: 'active',
        currentPeriodStart: new Date('2024-01-01T00:00:00Z'),
        currentPeriodEnd: new Date('2024-02-01T00:00:00Z'),
        isActive: true,
        billingCycle: 'monthly',
        amount: 99.99,
        currency: 'USD'
    };

    const sampleAccessRight = {
        id: '550e8400-e29b-41d4-a716-446655440005',
        resourceType: 'accommodation',
        resourceId: '550e8400-e29b-41d4-a716-446655440006',
        action: 'create',
        permission: 'write',
        isActive: true,
        expiresAt: new Date('2024-12-31T23:59:59Z'),
        grantedAt: new Date('2024-01-01T00:00:00Z'),
        grantedById: '550e8400-e29b-41d4-a716-446655440002'
    };

    describe('ClientWithUserSchema', () => {
        it('should validate client with user data', () => {
            const clientWithUser = {
                ...baseClientData,
                user: sampleUser
            };

            const result = ClientWithUserSchema.safeParse(clientWithUser);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.user?.id).toBe(sampleUser.id);
                expect(result.data.user?.email).toBe(sampleUser.email);
                expect(result.data.user?.role).toBe(sampleUser.role);
            }
        });

        it('should validate client with null user', () => {
            const clientWithUser = {
                ...baseClientData,
                user: null
            };

            const result = ClientWithUserSchema.safeParse(clientWithUser);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.user).toBeNull();
            }
        });
    });

    describe('ClientWithSubscriptionsSchema', () => {
        it('should validate client with subscriptions', () => {
            const clientWithSubscriptions = {
                ...baseClientData,
                subscriptions: [sampleSubscription],
                subscriptionsCount: 1,
                activeSubscriptionsCount: 1
            };

            const result = ClientWithSubscriptionsSchema.safeParse(clientWithSubscriptions);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.subscriptions).toHaveLength(1);
                expect(result.data.subscriptions?.[0]?.planName).toBe('Premium Plan');
                expect(result.data.subscriptionsCount).toBe(1);
                expect(result.data.activeSubscriptionsCount).toBe(1);
            }
        });

        it('should validate client without subscriptions', () => {
            const clientWithSubscriptions = {
                ...baseClientData,
                subscriptions: undefined,
                subscriptionsCount: 0,
                activeSubscriptionsCount: 0
            };

            const result = ClientWithSubscriptionsSchema.safeParse(clientWithSubscriptions);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.subscriptions).toBeUndefined();
                expect(result.data.subscriptionsCount).toBe(0);
            }
        });
    });

    describe('ClientWithAccessRightsSchema', () => {
        it('should validate client with access rights', () => {
            const clientWithAccessRights = {
                ...baseClientData,
                accessRights: [sampleAccessRight],
                accessRightsCount: 1,
                activeAccessRightsCount: 1
            };

            const result = ClientWithAccessRightsSchema.safeParse(clientWithAccessRights);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.accessRights).toHaveLength(1);
                expect(result.data.accessRights?.[0]?.resourceType).toBe('accommodation');
                expect(result.data.accessRights?.[0]?.action).toBe('create');
                expect(result.data.accessRightsCount).toBe(1);
            }
        });
    });

    describe('ClientWithFullRelationsSchema', () => {
        it('should validate client with all relations', () => {
            const clientWithFullRelations = {
                ...baseClientData,
                user: sampleUser,
                subscriptions: [sampleSubscription],
                subscriptionsCount: 1,
                activeSubscriptionsCount: 1,
                accessRights: [sampleAccessRight],
                accessRightsCount: 1,
                activeAccessRightsCount: 1
            };

            const result = ClientWithFullRelationsSchema.safeParse(clientWithFullRelations);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.user?.email).toBe(sampleUser.email);
                expect(result.data.subscriptions).toHaveLength(1);
                expect(result.data.accessRights).toHaveLength(1);
                expect(result.data.subscriptionsCount).toBe(1);
                expect(result.data.accessRightsCount).toBe(1);
            }
        });
    });

    describe('ClientOverviewSchema', () => {
        it('should validate client overview with minimal user data', () => {
            const clientOverview = {
                ...baseClientData,
                user: {
                    id: sampleUser.id,
                    email: sampleUser.email,
                    displayName: sampleUser.displayName,
                    isActive: sampleUser.isActive
                },
                activeSubscriptionsCount: 2,
                totalAccessRights: 5
            };

            const result = ClientOverviewSchema.safeParse(clientOverview);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.user?.id).toBe(sampleUser.id);
                expect(result.data.activeSubscriptionsCount).toBe(2);
                expect(result.data.totalAccessRights).toBe(5);
            }
        });
    });

    describe('ClientDetailSchema', () => {
        it('should validate client detail with selected relation fields', () => {
            const clientDetail = {
                ...baseClientData,
                user: sampleUser,
                subscriptions: [
                    {
                        id: sampleSubscription.id,
                        planName: sampleSubscription.planName,
                        status: sampleSubscription.status,
                        currentPeriodEnd: sampleSubscription.currentPeriodEnd,
                        isActive: sampleSubscription.isActive
                    }
                ],
                recentAccessRights: [
                    {
                        id: sampleAccessRight.id,
                        resourceType: sampleAccessRight.resourceType,
                        action: sampleAccessRight.action,
                        permission: sampleAccessRight.permission,
                        isActive: sampleAccessRight.isActive,
                        grantedAt: sampleAccessRight.grantedAt
                    }
                ]
            };

            const result = ClientDetailSchema.safeParse(clientDetail);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.subscriptions).toHaveLength(1);
                expect(result.data.recentAccessRights).toHaveLength(1);
                expect(result.data.subscriptions?.[0]?.planName).toBe('Premium Plan');
                expect(result.data.recentAccessRights?.[0]?.resourceType).toBe('accommodation');
            }
        });
    });

    describe('ClientRelationConfigSchema', () => {
        it('should validate relation configuration with defaults', () => {
            const config = {};

            const result = ClientRelationConfigSchema.safeParse(config);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.includeUser).toBe(false);
                expect(result.data.includeSubscriptions).toBe(false);
                expect(result.data.includeAccessRights).toBe(false);
                expect(result.data.subscriptionsLimit).toBe(10);
                expect(result.data.accessRightsLimit).toBe(10);
                expect(result.data.onlyActiveSubscriptions).toBe(false);
                expect(result.data.onlyActiveAccessRights).toBe(false);
            }
        });

        it('should validate custom relation configuration', () => {
            const config = {
                includeUser: true,
                includeSubscriptions: true,
                includeAccessRights: true,
                subscriptionsLimit: 5,
                accessRightsLimit: 20,
                onlyActiveSubscriptions: true,
                onlyActiveAccessRights: true
            };

            const result = ClientRelationConfigSchema.safeParse(config);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.includeUser).toBe(true);
                expect(result.data.subscriptionsLimit).toBe(5);
                expect(result.data.accessRightsLimit).toBe(20);
                expect(result.data.onlyActiveSubscriptions).toBe(true);
            }
        });

        it('should fail validation for invalid limits', () => {
            const config = {
                subscriptionsLimit: 0, // Invalid: too low
                accessRightsLimit: 101 // Invalid: too high
            };

            const result = ClientRelationConfigSchema.safeParse(config);
            expect(result.success).toBe(false);
        });
    });
});
