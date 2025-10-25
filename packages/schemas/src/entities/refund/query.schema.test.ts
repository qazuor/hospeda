import { describe, expect, it } from 'vitest';
import { RefundQuerySchema } from './query.schema.js';
import { RefundReasonEnum, RefundStatusEnum } from './refund.schema.js';

describe('RefundQuerySchema', () => {
    it('should validate empty query', () => {
        expect(() => RefundQuerySchema.parse({})).not.toThrow();
    });

    it('should validate query with search text', () => {
        const query = { q: 'REF-2024' };
        expect(() => RefundQuerySchema.parse(query)).not.toThrow();
    });

    it('should validate query with filters', () => {
        const query = {
            paymentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
            currency: 'USD',
            reason: RefundReasonEnum.CUSTOMER_REQUEST,
            status: RefundStatusEnum.COMPLETED
        };
        expect(() => RefundQuerySchema.parse(query)).not.toThrow();
    });

    it('should validate amount range query', () => {
        const query = {
            amountMin: 10.0,
            amountMax: 100.0
        };
        expect(() => RefundQuerySchema.parse(query)).not.toThrow();
    });

    it('should validate processed date range query', () => {
        const query = {
            processedAtFrom: new Date('2024-01-01'),
            processedAtTo: new Date('2024-12-31')
        };
        expect(() => RefundQuerySchema.parse(query)).not.toThrow();
    });

    it('should validate created date range query', () => {
        const query = {
            createdAtFrom: new Date('2024-01-01'),
            createdAtTo: new Date('2024-12-31')
        };
        expect(() => RefundQuerySchema.parse(query)).not.toThrow();
    });

    it('should validate query with provider refund ID', () => {
        const query = {
            providerRefundId: 'stripe_re_123456'
        };
        expect(() => RefundQuerySchema.parse(query)).not.toThrow();
    });

    it('should reject invalid amount range (min > max)', () => {
        const query = {
            amountMin: 100.0,
            amountMax: 10.0
        };
        expect(() => RefundQuerySchema.parse(query)).toThrow();
    });

    it('should reject invalid processed date range (from > to)', () => {
        const query = {
            processedAtFrom: new Date('2024-12-31'),
            processedAtTo: new Date('2024-01-01')
        };
        expect(() => RefundQuerySchema.parse(query)).toThrow();
    });

    it('should reject invalid created date range (from > to)', () => {
        const query = {
            createdAtFrom: new Date('2024-12-31'),
            createdAtTo: new Date('2024-01-01')
        };
        expect(() => RefundQuerySchema.parse(query)).toThrow();
    });

    it('should reject negative amount min', () => {
        const query = {
            amountMin: -10
        };
        expect(() => RefundQuerySchema.parse(query)).toThrow();
    });

    it('should reject negative amount max', () => {
        const query = {
            amountMax: -10
        };
        expect(() => RefundQuerySchema.parse(query)).toThrow();
    });

    it('should reject invalid UUID', () => {
        const query = {
            paymentId: 'invalid-id'
        };
        expect(() => RefundQuerySchema.parse(query)).toThrow();
    });

    it('should reject empty search text', () => {
        const query = { q: '' };
        expect(() => RefundQuerySchema.parse(query)).toThrow();
    });
});
