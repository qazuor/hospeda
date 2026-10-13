/**
 * Unit tests for the admin action 14 contract (HOS-1540, ACC:14, RF4).
 *
 * @module test/api/billing/external-refund-settlement.schema
 */

import { describe, expect, it } from 'vitest';
import {
    ExternalRefundSettlementRequestSchema,
    ExternalRefundSettlementResponseSchema
} from '../../../src/api/billing/external-refund-settlement.schema.js';

const PAYMENT_ID = '7a1f4c2e-3b5d-4e6f-8a9b-0c1d2e3f4a5b';
const MANUAL_PAYMENT_ID = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d';
const REFUND_ID = '9e8d7c6b-5a49-4382-9716-05f4e3d2c1b0';

const baseBody = {
    amount: 15000,
    channel: 'BANK_TRANSFER',
    reference: 'OP-12345',
    reason: 'OUT_OF_FLOW_REFUND'
} as const;

describe('ExternalRefundSettlementRequestSchema', () => {
    it('accepts a provider payment settlement', () => {
        // Arrange
        const body = { ...baseBody, paymentId: PAYMENT_ID, refundId: REFUND_ID };

        // Act
        const result = ExternalRefundSettlementRequestSchema.safeParse(body);

        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts a manual payment settlement with its scope', () => {
        const result = ExternalRefundSettlementRequestSchema.safeParse({
            ...baseBody,
            reason: 'MANUAL_PAYMENT_REFUND',
            manualPaymentId: MANUAL_PAYMENT_ID,
            manualPaymentScope: 'TOTAL'
        });

        expect(result.success).toBe(true);
    });

    it('trims the reference', () => {
        const result = ExternalRefundSettlementRequestSchema.parse({
            ...baseBody,
            paymentId: PAYMENT_ID,
            reference: '  OP-1  '
        });

        expect(result.reference).toBe('OP-1');
    });

    it('rejects a body with neither payment id', () => {
        const result = ExternalRefundSettlementRequestSchema.safeParse({ ...baseBody });

        expect(result.success).toBe(false);
    });

    it('rejects a body with both payment ids', () => {
        const result = ExternalRefundSettlementRequestSchema.safeParse({
            ...baseBody,
            paymentId: PAYMENT_ID,
            manualPaymentId: MANUAL_PAYMENT_ID
        });

        expect(result.success).toBe(false);
    });

    it.each([0, -100, 10.5])('rejects the amount %s', (amount) => {
        const result = ExternalRefundSettlementRequestSchema.safeParse({
            ...baseBody,
            paymentId: PAYMENT_ID,
            amount
        });

        expect(result.success).toBe(false);
    });

    it.each(['', '   ', 'x'.repeat(256)])('rejects the reference %j', (reference) => {
        const result = ExternalRefundSettlementRequestSchema.safeParse({
            ...baseBody,
            paymentId: PAYMENT_ID,
            reference
        });

        expect(result.success).toBe(false);
    });

    it('rejects a channel outside the list', () => {
        const result = ExternalRefundSettlementRequestSchema.safeParse({
            ...baseBody,
            paymentId: PAYMENT_ID,
            channel: 'CASH'
        });

        expect(result.success).toBe(false);
    });

    it('rejects a reason outside the list', () => {
        const result = ExternalRefundSettlementRequestSchema.safeParse({
            ...baseBody,
            paymentId: PAYMENT_ID,
            reason: 'REVOCATION'
        });

        expect(result.success).toBe(false);
    });
});

describe('ExternalRefundSettlementResponseSchema', () => {
    it.each([
        'P3',
        'P4',
        'P5',
        'ALREADY_APPLIED',
        null
    ])('accepts the payment outcome %s', (paymentOutcome) => {
        const result = ExternalRefundSettlementResponseSchema.safeParse({
            refundId: REFUND_ID,
            status: 'EXECUTED',
            closedRequestedRefund: false,
            paymentOutcome,
            coverageReleased: paymentOutcome === 'P3'
        });

        expect(result.success).toBe(true);
    });

    it('rejects a free-form payment outcome and a status other than EXECUTED', () => {
        const base = {
            refundId: REFUND_ID,
            status: 'EXECUTED',
            closedRequestedRefund: true,
            paymentOutcome: 'P3',
            coverageReleased: true
        };

        expect(
            ExternalRefundSettlementResponseSchema.safeParse({ ...base, paymentOutcome: 'done' })
                .success
        ).toBe(false);
        expect(
            ExternalRefundSettlementResponseSchema.safeParse({ ...base, status: 'REQUESTED' })
                .success
        ).toBe(false);
    });
});
