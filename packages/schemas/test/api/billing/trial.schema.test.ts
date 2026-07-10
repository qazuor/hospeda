/**
 * Unit tests for the trial reactivation schemas (HOS-114 T-008).
 *
 * Covers:
 * - `ReactivateTrialRequestSchema` / `ReactivateSubscriptionRequestSchema`
 *   (existing request contracts, now wired up in `apps/api`).
 * - `ReactivateTrialResponseSchema` / `ReactivateSubscriptionResponseSchema`
 *   (new — the paid-checkout response shape carrying `checkoutUrl` +
 *   `status: 'incomplete'`).
 *
 * @module test/api/billing/trial.schema
 */

import { describe, expect, it } from 'vitest';
import {
    ReactivateSubscriptionRequestSchema,
    ReactivateSubscriptionResponseSchema,
    ReactivateTrialRequestSchema,
    ReactivateTrialResponseSchema
} from '../../../src/api/billing/trial.schema.js';

describe('ReactivateTrialRequestSchema', () => {
    it('should accept a valid non-empty planId', () => {
        // Arrange
        const input = { planId: 'plan-owner-pro' };

        // Act
        const result = ReactivateTrialRequestSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject an empty planId', () => {
        // Arrange
        const input = { planId: '' };

        // Act
        const result = ReactivateTrialRequestSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject a missing planId', () => {
        // Arrange
        const input = {};

        // Act
        const result = ReactivateTrialRequestSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should default billingInterval to "monthly" when omitted (regression)', () => {
        // Arrange
        const input = { planId: 'plan-owner-pro' };

        // Act
        const result = ReactivateTrialRequestSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.billingInterval).toBe('monthly');
        }
    });

    it('should accept billingInterval "annual"', () => {
        // Arrange
        const input = { planId: 'plan-owner-pro', billingInterval: 'annual' as const };

        // Act
        const result = ReactivateTrialRequestSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.billingInterval).toBe('annual');
        }
    });

    it('should reject an invalid billingInterval value', () => {
        // Arrange
        const input = { planId: 'plan-owner-pro', billingInterval: 'quarterly' };

        // Act
        const result = ReactivateTrialRequestSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('ReactivateSubscriptionRequestSchema', () => {
    it('should accept a valid non-empty planId', () => {
        // Arrange
        const input = { planId: 'plan-owner-pro' };

        // Act
        const result = ReactivateSubscriptionRequestSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject an empty planId', () => {
        // Arrange
        const input = { planId: '' };

        // Act
        const result = ReactivateSubscriptionRequestSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should default billingInterval to "monthly" when omitted (regression)', () => {
        // Arrange
        const input = { planId: 'plan-owner-pro' };

        // Act
        const result = ReactivateSubscriptionRequestSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.billingInterval).toBe('monthly');
        }
    });

    it('should accept billingInterval "annual"', () => {
        // Arrange
        const input = { planId: 'plan-owner-pro', billingInterval: 'annual' as const };

        // Act
        const result = ReactivateSubscriptionRequestSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.billingInterval).toBe('annual');
        }
    });

    it('should reject an invalid billingInterval value', () => {
        // Arrange
        const input = { planId: 'plan-owner-pro', billingInterval: 'quarterly' };

        // Act
        const result = ReactivateSubscriptionRequestSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('ReactivateTrialResponseSchema', () => {
    const VALID_RESPONSE = {
        success: true,
        subscriptionId: 'sub_paid_123',
        checkoutUrl: 'https://mp.test/checkout/abc',
        status: 'incomplete' as const,
        message: 'Redirect to MercadoPago to complete reactivation'
    };

    it('should accept a valid successful reactivation response', () => {
        // Act
        const result = ReactivateTrialResponseSchema.safeParse(VALID_RESPONSE);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe('incomplete');
            expect(result.data.checkoutUrl).toBe(VALID_RESPONSE.checkoutUrl);
        }
    });

    it('should accept a null subscriptionId and null checkoutUrl', () => {
        // Arrange
        const input = { ...VALID_RESPONSE, subscriptionId: null, checkoutUrl: null };

        // Act
        const result = ReactivateTrialResponseSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject a checkoutUrl that is not a valid URL', () => {
        // Arrange
        const input = { ...VALID_RESPONSE, checkoutUrl: 'not-a-url' };

        // Act
        const result = ReactivateTrialResponseSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject a status other than "incomplete"', () => {
        // Arrange
        const input = { ...VALID_RESPONSE, status: 'active' };

        // Act
        const result = ReactivateTrialResponseSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should accept status "pending_provider" (annual direct-insert result)', () => {
        // Arrange
        const input = { ...VALID_RESPONSE, status: 'pending_provider' as const };

        // Act
        const result = ReactivateTrialResponseSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe('pending_provider');
        }
    });

    it('should still accept a historic status "incomplete" payload (regression)', () => {
        // Act
        const result = ReactivateTrialResponseSchema.safeParse(VALID_RESPONSE);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe('incomplete');
        }
    });

    it('should reject a missing message', () => {
        // Arrange
        const { message: _message, ...input } = VALID_RESPONSE;

        // Act
        const result = ReactivateTrialResponseSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('ReactivateSubscriptionResponseSchema', () => {
    const VALID_RESPONSE = {
        success: true,
        subscriptionId: 'sub_new_123',
        previousPlanId: 'plan_old',
        checkoutUrl: 'https://mp.test/checkout/xyz',
        status: 'incomplete' as const,
        message: 'Redirect to MercadoPago to complete reactivation'
    };

    it('should accept a valid successful reactivation response', () => {
        // Act
        const result = ReactivateSubscriptionResponseSchema.safeParse(VALID_RESPONSE);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept a null previousPlanId', () => {
        // Arrange
        const input = { ...VALID_RESPONSE, previousPlanId: null };

        // Act
        const result = ReactivateSubscriptionResponseSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept a response with previousPlanId omitted entirely', () => {
        // Arrange
        const { previousPlanId: _previousPlanId, ...input } = VALID_RESPONSE;

        // Act
        const result = ReactivateSubscriptionResponseSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject a status other than "incomplete"', () => {
        // Arrange
        const input = { ...VALID_RESPONSE, status: 'trialing' };

        // Act
        const result = ReactivateSubscriptionResponseSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should accept status "pending_provider" (annual direct-insert result)', () => {
        // Arrange
        const input = { ...VALID_RESPONSE, status: 'pending_provider' as const };

        // Act
        const result = ReactivateSubscriptionResponseSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe('pending_provider');
        }
    });

    it('should still accept a historic status "incomplete" payload (regression)', () => {
        // Act
        const result = ReactivateSubscriptionResponseSchema.safeParse(VALID_RESPONSE);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe('incomplete');
        }
    });

    it('should reject a null checkoutUrl that is not a valid URL string when non-null', () => {
        // Arrange
        const input = { ...VALID_RESPONSE, checkoutUrl: 'not-a-url' };

        // Act
        const result = ReactivateSubscriptionResponseSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });
});
