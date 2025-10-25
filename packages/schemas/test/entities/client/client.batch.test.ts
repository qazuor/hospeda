import { describe, expect, it } from 'vitest';
import {
    ClientBatchCreateRequestSchema,
    ClientBatchCreateResponseSchema,
    ClientBatchDeleteRequestSchema,
    ClientBatchDeleteResponseSchema,
    ClientBatchRequestSchema,
    ClientBatchResponseSchema,
    ClientBatchUpdateRequestSchema
} from '../../../src/entities/client/client.batch.schema.js';
import { LifecycleStatusEnum } from '../../../src/enums/lifecycle-state.enum.js';

describe('Client Batch Schemas', () => {
    describe('ClientBatchRequestSchema', () => {
        it('should validate batch request with IDs only', () => {
            const request = {
                ids: [
                    '550e8400-e29b-41d4-a716-446655440000',
                    '550e8400-e29b-41d4-a716-446655440001'
                ]
            };

            const result = ClientBatchRequestSchema.safeParse(request);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.ids).toHaveLength(2);
                expect(result.data.fields).toBeUndefined();
                expect(result.data.includeUser).toBe(false);
                expect(result.data.includeSubscriptions).toBe(false);
                expect(result.data.includeAccessRights).toBe(false);
            }
        });

        it('should validate batch request with fields and relations', () => {
            const request = {
                ids: ['550e8400-e29b-41d4-a716-446655440000'],
                fields: ['id', 'name', 'billingEmail'],
                includeUser: true,
                includeSubscriptions: true
            };

            const result = ClientBatchRequestSchema.safeParse(request);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.fields).toEqual(['id', 'name', 'billingEmail']);
                expect(result.data.includeUser).toBe(true);
                expect(result.data.includeSubscriptions).toBe(true);
                expect(result.data.includeAccessRights).toBe(false);
            }
        });

        it('should fail validation for empty IDs array', () => {
            const request = { ids: [] };

            const result = ClientBatchRequestSchema.safeParse(request);
            expect(result.success).toBe(false);
        });

        it('should fail validation for too many IDs', () => {
            const request = {
                ids: Array.from(
                    { length: 101 },
                    (_, i) => `550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, '0')}`
                )
            };

            const result = ClientBatchRequestSchema.safeParse(request);
            expect(result.success).toBe(false);
        });

        it('should fail validation for invalid UUID format', () => {
            const request = { ids: ['invalid-uuid'] };

            const result = ClientBatchRequestSchema.safeParse(request);
            expect(result.success).toBe(false);
        });
    });

    describe('ClientBatchCreateRequestSchema', () => {
        it('should validate batch create request', () => {
            const request = {
                clients: [
                    {
                        userId: '550e8400-e29b-41d4-a716-446655440001',
                        name: 'Client One',
                        billingEmail: 'billing1@client.com',
                        lifecycleState: LifecycleStatusEnum.ACTIVE
                    },
                    {
                        userId: '550e8400-e29b-41d4-a716-446655440002',
                        name: 'Client Two',
                        billingEmail: 'billing2@client.com',
                        lifecycleState: LifecycleStatusEnum.ACTIVE
                    }
                ],
                continueOnError: true,
                validateOnly: false
            };

            const result = ClientBatchCreateRequestSchema.safeParse(request);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.clients).toHaveLength(2);
                expect(result.data.continueOnError).toBe(true);
                expect(result.data.validateOnly).toBe(false);
            }
        });

        it('should validate with defaults', () => {
            const request = {
                clients: [
                    {
                        userId: null,
                        name: 'Client One',
                        billingEmail: 'billing1@client.com',
                        lifecycleState: LifecycleStatusEnum.ACTIVE
                    }
                ]
            };

            const result = ClientBatchCreateRequestSchema.safeParse(request);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.continueOnError).toBe(false);
                expect(result.data.validateOnly).toBe(false);
            }
        });

        it('should fail validation for too many clients', () => {
            const request = {
                clients: Array.from({ length: 51 }, (_, i) => ({
                    userId: null,
                    name: `Client ${i}`,
                    billingEmail: `billing${i}@client.com`,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                }))
            };

            const result = ClientBatchCreateRequestSchema.safeParse(request);
            expect(result.success).toBe(false);
        });
    });

    describe('ClientBatchUpdateRequestSchema', () => {
        it('should validate batch update request', () => {
            const request = {
                updates: [
                    {
                        id: '550e8400-e29b-41d4-a716-446655440000',
                        data: {
                            name: 'Updated Client Name',
                            billingEmail: 'updated@client.com'
                        }
                    }
                ],
                continueOnError: false
            };

            const result = ClientBatchUpdateRequestSchema.safeParse(request);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.updates).toHaveLength(1);
                expect(result.data.updates[0]?.data.name).toBe('Updated Client Name');
                expect(result.data.continueOnError).toBe(false);
            }
        });

        it('should validate partial updates', () => {
            const request = {
                updates: [
                    {
                        id: '550e8400-e29b-41d4-a716-446655440000',
                        data: {
                            name: 'New Name Only'
                        }
                    }
                ]
            };

            const result = ClientBatchUpdateRequestSchema.safeParse(request);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.updates[0]?.data.name).toBe('New Name Only');
                expect(result.data.updates[0]?.data.billingEmail).toBeUndefined();
            }
        });
    });

    describe('ClientBatchDeleteRequestSchema', () => {
        it('should validate batch delete request', () => {
            const request = {
                ids: [
                    '550e8400-e29b-41d4-a716-446655440000',
                    '550e8400-e29b-41d4-a716-446655440001'
                ],
                hardDelete: true,
                continueOnError: false
            };

            const result = ClientBatchDeleteRequestSchema.safeParse(request);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.ids).toHaveLength(2);
                expect(result.data.hardDelete).toBe(true);
                expect(result.data.continueOnError).toBe(false);
            }
        });

        it('should validate with defaults', () => {
            const request = {
                ids: ['550e8400-e29b-41d4-a716-446655440000']
            };

            const result = ClientBatchDeleteRequestSchema.safeParse(request);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.hardDelete).toBe(false);
                expect(result.data.continueOnError).toBe(false);
            }
        });

        it('should fail validation for too many IDs', () => {
            const request = {
                ids: Array.from(
                    { length: 51 },
                    (_, i) => `550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, '0')}`
                )
            };

            const result = ClientBatchDeleteRequestSchema.safeParse(request);
            expect(result.success).toBe(false);
        });
    });

    describe('Response Schemas', () => {
        const sampleClient = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            userId: '550e8400-e29b-41d4-a716-446655440001',
            name: 'Test Client',
            billingEmail: 'billing@test.com',
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-01T00:00:00Z'),
            createdById: '550e8400-e29b-41d4-a716-446655440002',
            updatedById: '550e8400-e29b-41d4-a716-446655440002',
            deletedAt: undefined,
            deletedById: undefined,
            adminInfo: null
        };

        it('should validate batch response with mixed results', () => {
            const response = [
                sampleClient,
                null, // Not found
                sampleClient
            ];

            const result = ClientBatchResponseSchema.safeParse(response);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data).toHaveLength(3);
                expect(result.data[0]?.id).toBe(sampleClient.id);
                expect(result.data[1]).toBeNull();
                expect(result.data[2]?.id).toBe(sampleClient.id);
            }
        });

        it('should validate batch create response', () => {
            const response = {
                results: [
                    sampleClient,
                    {
                        error: 'Validation failed',
                        index: 1,
                        input: { name: 'Invalid', billingEmail: 'invalid-email' }
                    }
                ],
                summary: {
                    total: 2,
                    successful: 1,
                    failed: 1
                }
            };

            const result = ClientBatchCreateResponseSchema.safeParse(response);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.results).toHaveLength(2);
                expect(result.data.summary.total).toBe(2);
                expect(result.data.summary.successful).toBe(1);
                expect(result.data.summary.failed).toBe(1);
            }
        });

        it('should validate batch delete response', () => {
            const response = {
                results: [
                    {
                        id: '550e8400-e29b-41d4-a716-446655440000',
                        success: true,
                        deletedAt: new Date('2024-01-01T12:00:00Z')
                    },
                    {
                        id: '550e8400-e29b-41d4-a716-446655440001',
                        success: false,
                        error: 'Client not found'
                    }
                ],
                summary: {
                    total: 2,
                    successful: 1,
                    failed: 1
                }
            };

            const result = ClientBatchDeleteResponseSchema.safeParse(response);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.results).toHaveLength(2);
                expect(result.data.results[0]?.success).toBe(true);
                expect(result.data.results[1]?.success).toBe(false);
            }
        });
    });
});
