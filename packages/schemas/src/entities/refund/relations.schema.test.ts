import { describe, expect, it } from 'vitest';
import { RefundReasonEnum, RefundStatusEnum } from './refund.schema.js';
import {
    RefundClientRelationSchema,
    RefundPaymentRelationSchema,
    RefundProcessorRelationSchema,
    RefundWithRelationsSchema
} from './relations.schema.js';

describe('Refund Relations Schemas', () => {
    describe('RefundPaymentRelationSchema', () => {
        it('should validate valid payment relation', () => {
            const paymentRelation = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                amount: 500.0,
                currency: 'USD',
                status: 'completed',
                provider: 'stripe'
            };
            expect(() => RefundPaymentRelationSchema.parse(paymentRelation)).not.toThrow();
        });

        it('should reject invalid UUID', () => {
            const paymentRelation = {
                id: 'invalid-id',
                amount: 500.0,
                currency: 'USD',
                status: 'completed',
                provider: 'stripe'
            };
            expect(() => RefundPaymentRelationSchema.parse(paymentRelation)).toThrow();
        });
    });

    describe('RefundClientRelationSchema', () => {
        it('should validate valid client relation', () => {
            const clientRelation = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                name: 'John Doe',
                email: 'john.doe@example.com'
            };
            expect(() => RefundClientRelationSchema.parse(clientRelation)).not.toThrow();
        });

        it('should reject invalid email', () => {
            const clientRelation = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                name: 'John Doe',
                email: 'invalid-email'
            };
            expect(() => RefundClientRelationSchema.parse(clientRelation)).toThrow();
        });

        it('should reject invalid UUID', () => {
            const clientRelation = {
                id: 'invalid-id',
                name: 'John Doe',
                email: 'john.doe@example.com'
            };
            expect(() => RefundClientRelationSchema.parse(clientRelation)).toThrow();
        });
    });

    describe('RefundProcessorRelationSchema', () => {
        it('should validate valid processor relation', () => {
            const processorRelation = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                name: 'Admin User',
                email: 'admin@example.com'
            };
            expect(() => RefundProcessorRelationSchema.parse(processorRelation)).not.toThrow();
        });

        it('should reject invalid email', () => {
            const processorRelation = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                name: 'Admin User',
                email: 'invalid-email'
            };
            expect(() => RefundProcessorRelationSchema.parse(processorRelation)).toThrow();
        });

        it('should reject invalid UUID', () => {
            const processorRelation = {
                id: 'invalid-id',
                name: 'Admin User',
                email: 'admin@example.com'
            };
            expect(() => RefundProcessorRelationSchema.parse(processorRelation)).toThrow();
        });
    });

    describe('RefundWithRelationsSchema', () => {
        const validRefundWithRelations = {
            id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            paymentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
            clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
            refundNumber: 'REF-2024-001',
            amount: 50.0,
            currency: 'USD',
            reason: RefundReasonEnum.CUSTOMER_REQUEST,
            status: RefundStatusEnum.PENDING,
            createdAt: new Date('2024-01-15T00:00:00Z'),
            updatedAt: new Date('2024-01-15T00:00:00Z'),
            createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
            updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d483'
        };

        it('should validate refund without relations', () => {
            expect(() => RefundWithRelationsSchema.parse(validRefundWithRelations)).not.toThrow();
        });

        it('should validate refund with payment relation', () => {
            const withPaymentRelation = {
                ...validRefundWithRelations,
                payment: {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                    amount: 500.0,
                    currency: 'USD',
                    status: 'completed',
                    provider: 'stripe'
                }
            };
            expect(() => RefundWithRelationsSchema.parse(withPaymentRelation)).not.toThrow();
        });

        it('should validate refund with client relation', () => {
            const withClientRelation = {
                ...validRefundWithRelations,
                client: {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
                    name: 'John Doe',
                    email: 'john.doe@example.com'
                }
            };
            expect(() => RefundWithRelationsSchema.parse(withClientRelation)).not.toThrow();
        });

        it('should validate refund with processor relation', () => {
            const withProcessorRelation = {
                ...validRefundWithRelations,
                processedBy: {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d484',
                    name: 'Admin User',
                    email: 'admin@example.com'
                }
            };
            expect(() => RefundWithRelationsSchema.parse(withProcessorRelation)).not.toThrow();
        });

        it('should validate refund with all relations', () => {
            const withAllRelations = {
                ...validRefundWithRelations,
                payment: {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                    amount: 500.0,
                    currency: 'USD',
                    status: 'completed',
                    provider: 'stripe'
                },
                client: {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
                    name: 'John Doe',
                    email: 'john.doe@example.com'
                },
                processedBy: {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d484',
                    name: 'Admin User',
                    email: 'admin@example.com'
                }
            };
            expect(() => RefundWithRelationsSchema.parse(withAllRelations)).not.toThrow();
        });

        it('should validate processed refund', () => {
            const processedRefund = {
                ...validRefundWithRelations,
                status: RefundStatusEnum.COMPLETED,
                processedAt: new Date('2024-01-16T00:00:00Z'),
                processedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d484'
            };
            expect(() => RefundWithRelationsSchema.parse(processedRefund)).not.toThrow();
        });

        it('should validate refund with provider data', () => {
            const withProviderData = {
                ...validRefundWithRelations,
                providerRefundId: 'stripe_re_123456',
                providerResponse: {
                    status: 'succeeded',
                    transactionId: 'txn_123456'
                }
            };
            expect(() => RefundWithRelationsSchema.parse(withProviderData)).not.toThrow();
        });

        it('should validate failed refund', () => {
            const failedRefund = {
                ...validRefundWithRelations,
                status: RefundStatusEnum.FAILED,
                failureReason: 'Insufficient funds in merchant account'
            };
            expect(() => RefundWithRelationsSchema.parse(failedRefund)).not.toThrow();
        });

        it('should validate refund with deletedAt date', () => {
            const deletedRefund = {
                ...validRefundWithRelations,
                deletedAt: new Date('2024-01-17T00:00:00Z'),
                deletedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d485'
            };
            expect(() => RefundWithRelationsSchema.parse(deletedRefund)).not.toThrow();
        });

        it('should validate refund with optional description', () => {
            const withDescription = {
                ...validRefundWithRelations,
                description: 'Customer requested full refund for cancellation'
            };
            expect(() => RefundWithRelationsSchema.parse(withDescription)).not.toThrow();
        });
    });
});
