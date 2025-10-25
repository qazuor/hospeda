import { describe, expect, it } from 'vitest';
import {
    ClientAccessRightBulkCreateInputSchema,
    ClientAccessRightCreateInputSchema,
    ClientAccessRightDeleteInputSchema,
    ClientAccessRightRestoreInputSchema,
    ClientAccessRightUpdateInputSchema
} from '../../../src/entities/client-access-right/client-access-right.crud.schema.js';
import { AccessRightScopeEnum } from '../../../src/enums/access-right-scope.enum.js';

describe('ClientAccessRight CRUD Schemas', () => {
    describe('Create Input Schema', () => {
        it('should validate a complete create input', () => {
            const createInput = {
                clientId: '550e8400-e29b-41d4-a716-446655440000',
                subscriptionItemId: '550e8400-e29b-41d4-a716-446655440001',
                feature: 'ACCOMMODATION_LISTING',
                scope: AccessRightScopeEnum.GLOBAL,
                scopeId: null,
                scopeType: null,
                validFrom: new Date('2024-01-01T00:00:00Z'),
                validTo: new Date('2024-12-31T23:59:59Z')
            };

            const result = ClientAccessRightCreateInputSchema.safeParse(createInput);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.feature).toBe('ACCOMMODATION_LISTING');
                expect(result.data.scope).toBe(AccessRightScopeEnum.GLOBAL);
            }
        });

        it('should validate scoped create input', () => {
            const createInput = {
                clientId: '550e8400-e29b-41d4-a716-446655440000',
                subscriptionItemId: '550e8400-e29b-41d4-a716-446655440001',
                feature: 'DESTINATION_CONTENT',
                scope: AccessRightScopeEnum.ACCOMMODATION,
                scopeId: '550e8400-e29b-41d4-a716-446655440002',
                scopeType: 'accommodation',
                validFrom: new Date('2024-01-01T00:00:00Z')
                // validTo is optional
            };

            const result = ClientAccessRightCreateInputSchema.safeParse(createInput);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.scopeId).toBe('550e8400-e29b-41d4-a716-446655440002');
                expect(result.data.scopeType).toBe('accommodation');
                expect(result.data.validTo).toBeUndefined();
            }
        });

        it('should fail validation for missing required fields', () => {
            const invalidInput = {
                clientId: '550e8400-e29b-41d4-a716-446655440000'
                // Missing required fields
            };

            const result = ClientAccessRightCreateInputSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });
    });

    describe('Update Input Schema', () => {
        it('should validate partial update input', () => {
            const updateInput = {
                feature: 'UPDATED_FEATURE',
                validTo: new Date('2025-12-31T23:59:59Z')
            };

            const result = ClientAccessRightUpdateInputSchema.safeParse(updateInput);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.feature).toBe('UPDATED_FEATURE');
                expect(result.data.clientId).toBeUndefined();
            }
        });

        it('should validate empty update input', () => {
            const updateInput = {};

            const result = ClientAccessRightUpdateInputSchema.safeParse(updateInput);
            expect(result.success).toBe(true);
        });
    });

    describe('Delete Input Schema', () => {
        it('should validate delete input with defaults', () => {
            const deleteInput = {
                id: '550e8400-e29b-41d4-a716-446655440000'
            };

            const result = ClientAccessRightDeleteInputSchema.safeParse(deleteInput);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.hardDelete).toBe(false);
                expect(result.data.reason).toBeUndefined();
            }
        });

        it('should validate delete input with reason', () => {
            const deleteInput = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                hardDelete: true,
                reason: 'Client subscription cancelled'
            };

            const result = ClientAccessRightDeleteInputSchema.safeParse(deleteInput);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.hardDelete).toBe(true);
                expect(result.data.reason).toBe('Client subscription cancelled');
            }
        });

        it('should fail validation for invalid UUID', () => {
            const deleteInput = {
                id: 'invalid-uuid'
            };

            const result = ClientAccessRightDeleteInputSchema.safeParse(deleteInput);
            expect(result.success).toBe(false);
        });
    });

    describe('Restore Input Schema', () => {
        it('should validate restore input', () => {
            const restoreInput = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                reason: 'Subscription reactivated'
            };

            const result = ClientAccessRightRestoreInputSchema.safeParse(restoreInput);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.reason).toBe('Subscription reactivated');
            }
        });
    });

    describe('Bulk Create Input Schema', () => {
        it('should validate bulk create input', () => {
            const bulkCreateInput = {
                clientAccessRights: [
                    {
                        clientId: '550e8400-e29b-41d4-a716-446655440000',
                        subscriptionItemId: '550e8400-e29b-41d4-a716-446655440001',
                        feature: 'FEATURE_A',
                        scope: AccessRightScopeEnum.GLOBAL,
                        validFrom: new Date()
                    },
                    {
                        clientId: '550e8400-e29b-41d4-a716-446655440000',
                        subscriptionItemId: '550e8400-e29b-41d4-a716-446655440001',
                        feature: 'FEATURE_B',
                        scope: AccessRightScopeEnum.ACCOMMODATION,
                        scopeId: '550e8400-e29b-41d4-a716-446655440002',
                        scopeType: 'accommodation',
                        validFrom: new Date()
                    }
                ],
                skipDuplicates: true,
                continueOnError: false
            };

            const result = ClientAccessRightBulkCreateInputSchema.safeParse(bulkCreateInput);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.clientAccessRights).toHaveLength(2);
                expect(result.data.skipDuplicates).toBe(true);
                expect(result.data.continueOnError).toBe(false);
            }
        });

        it('should fail validation for empty array', () => {
            const bulkCreateInput = {
                clientAccessRights: []
            };

            const result = ClientAccessRightBulkCreateInputSchema.safeParse(bulkCreateInput);
            expect(result.success).toBe(false);
        });

        it('should fail validation for too many items', () => {
            const bulkCreateInput = {
                clientAccessRights: Array.from({ length: 101 }, (_, i) => ({
                    clientId: '550e8400-e29b-41d4-a716-446655440000',
                    subscriptionItemId: '550e8400-e29b-41d4-a716-446655440001',
                    feature: `FEATURE_${i}`,
                    scope: AccessRightScopeEnum.GLOBAL,
                    validFrom: new Date()
                }))
            };

            const result = ClientAccessRightBulkCreateInputSchema.safeParse(bulkCreateInput);
            expect(result.success).toBe(false);
        });
    });
});
