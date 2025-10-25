import { describe, expect, it } from 'vitest';
import {
    type ClientAccessRight,
    ClientAccessRightSchema
} from '../../../src/entities/client-access-right/client-access-right.schema.js';
import { AccessRightScopeEnum } from '../../../src/enums/access-right-scope.enum.js';

describe('ClientAccessRight Schema', () => {
    describe('Validation', () => {
        it('should validate a complete client access right', () => {
            const clientAccessRight: ClientAccessRight = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                clientId: '550e8400-e29b-41d4-a716-446655440001',
                subscriptionItemId: '550e8400-e29b-41d4-a716-446655440002',
                feature: 'ACCOMMODATION_LISTING',
                scope: AccessRightScopeEnum.GLOBAL,
                scopeId: null,
                scopeType: null,
                validFrom: new Date('2024-01-01T00:00:00Z'),
                validTo: new Date('2024-12-31T23:59:59Z'),
                createdAt: new Date('2024-01-01T00:00:00Z'),
                updatedAt: new Date('2024-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003',
                deletedAt: undefined,
                deletedById: undefined,
                adminInfo: null
            };

            const result = ClientAccessRightSchema.safeParse(clientAccessRight);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.feature).toBe('ACCOMMODATION_LISTING');
                expect(result.data.scope).toBe(AccessRightScopeEnum.GLOBAL);
                expect(result.data.scopeId).toBeNull();
                expect(result.data.scopeType).toBeNull();
            }
        });

        it('should validate scoped access right', () => {
            const clientAccessRight = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                clientId: '550e8400-e29b-41d4-a716-446655440001',
                subscriptionItemId: '550e8400-e29b-41d4-a716-446655440002',
                feature: 'DESTINATION_CONTENT',
                scope: AccessRightScopeEnum.ACCOMMODATION,
                scopeId: '550e8400-e29b-41d4-a716-446655440004',
                scopeType: 'destination',
                validFrom: new Date('2024-01-01T00:00:00Z'),
                validTo: new Date('2024-12-31T23:59:59Z'),
                createdAt: new Date('2024-01-01T00:00:00Z'),
                updatedAt: new Date('2024-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003',
                deletedAt: undefined,
                deletedById: undefined,
                adminInfo: null
            };

            const result = ClientAccessRightSchema.safeParse(clientAccessRight);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.scope).toBe(AccessRightScopeEnum.ACCOMMODATION);
                expect(result.data.scopeId).toBe('550e8400-e29b-41d4-a716-446655440004');
                expect(result.data.scopeType).toBe('destination');
            }
        });

        it('should validate without validTo date', () => {
            const clientAccessRight = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                clientId: '550e8400-e29b-41d4-a716-446655440001',
                subscriptionItemId: '550e8400-e29b-41d4-a716-446655440002',
                feature: 'ANALYTICS_DASHBOARD',
                scope: AccessRightScopeEnum.GLOBAL,
                scopeId: null,
                scopeType: null,
                validFrom: new Date('2024-01-01T00:00:00Z'),
                // validTo is optional
                createdAt: new Date('2024-01-01T00:00:00Z'),
                updatedAt: new Date('2024-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003',
                deletedAt: undefined,
                deletedById: undefined,
                adminInfo: null
            };

            const result = ClientAccessRightSchema.safeParse(clientAccessRight);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.validTo).toBeUndefined();
            }
        });

        it('should validate with admin info', () => {
            const clientAccessRight = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                clientId: '550e8400-e29b-41d4-a716-446655440001',
                subscriptionItemId: '550e8400-e29b-41d4-a716-446655440002',
                feature: 'PREMIUM_SUPPORT',
                scope: AccessRightScopeEnum.GLOBAL,
                scopeId: null,
                scopeType: null,
                validFrom: new Date('2024-01-01T00:00:00Z'),
                validTo: new Date('2024-12-31T23:59:59Z'),
                createdAt: new Date('2024-01-01T00:00:00Z'),
                updatedAt: new Date('2024-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003',
                deletedAt: undefined,
                deletedById: undefined,
                adminInfo: {
                    notes: 'Special premium access for enterprise client',
                    favorite: true
                }
            };

            const result = ClientAccessRightSchema.safeParse(clientAccessRight);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.adminInfo?.notes).toBe(
                    'Special premium access for enterprise client'
                );
                expect(result.data.adminInfo?.favorite).toBe(true);
            }
        });
    });

    describe('Validation Failures', () => {
        it('should fail validation for missing required fields', () => {
            const invalidClientAccessRight = {
                id: '550e8400-e29b-41d4-a716-446655440000'
                // Missing required fields
            };

            const result = ClientAccessRightSchema.safeParse(invalidClientAccessRight);
            expect(result.success).toBe(false);
        });

        it('should fail validation for invalid UUID in clientId', () => {
            const invalidClientAccessRight = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                clientId: 'invalid-uuid',
                subscriptionItemId: '550e8400-e29b-41d4-a716-446655440002',
                feature: 'TEST_FEATURE',
                scope: AccessRightScopeEnum.GLOBAL,
                validFrom: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003'
            };

            const result = ClientAccessRightSchema.safeParse(invalidClientAccessRight);
            expect(result.success).toBe(false);
        });

        it('should fail validation for empty feature', () => {
            const invalidClientAccessRight = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                clientId: '550e8400-e29b-41d4-a716-446655440001',
                subscriptionItemId: '550e8400-e29b-41d4-a716-446655440002',
                feature: '', // Empty feature
                scope: AccessRightScopeEnum.GLOBAL,
                validFrom: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003'
            };

            const result = ClientAccessRightSchema.safeParse(invalidClientAccessRight);
            expect(result.success).toBe(false);
        });

        it('should fail validation for feature too long', () => {
            const invalidClientAccessRight = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                clientId: '550e8400-e29b-41d4-a716-446655440001',
                subscriptionItemId: '550e8400-e29b-41d4-a716-446655440002',
                feature: 'A'.repeat(101), // Too long feature
                scope: AccessRightScopeEnum.GLOBAL,
                validFrom: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003'
            };

            const result = ClientAccessRightSchema.safeParse(invalidClientAccessRight);
            expect(result.success).toBe(false);
        });

        it('should fail validation for invalid scope', () => {
            const invalidClientAccessRight = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                clientId: '550e8400-e29b-41d4-a716-446655440001',
                subscriptionItemId: '550e8400-e29b-41d4-a716-446655440002',
                feature: 'TEST_FEATURE',
                scope: 'INVALID_SCOPE', // Invalid scope
                validFrom: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003'
            };

            const result = ClientAccessRightSchema.safeParse(invalidClientAccessRight);
            expect(result.success).toBe(false);
        });

        it('should fail validation for invalid scopeId UUID', () => {
            const invalidClientAccessRight = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                clientId: '550e8400-e29b-41d4-a716-446655440001',
                subscriptionItemId: '550e8400-e29b-41d4-a716-446655440002',
                feature: 'TEST_FEATURE',
                scope: AccessRightScopeEnum.ACCOMMODATION,
                scopeId: 'invalid-uuid', // Invalid UUID
                scopeType: 'destination',
                validFrom: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003'
            };

            const result = ClientAccessRightSchema.safeParse(invalidClientAccessRight);
            expect(result.success).toBe(false);
        });
    });
});
