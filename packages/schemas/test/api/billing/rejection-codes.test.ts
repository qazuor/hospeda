import { describe, expect, it } from 'vitest';
import {
    LIFT_RECONCILIATION_MARK_REJECTIONS,
    PLAN_MIGRATION_REJECTIONS,
    PROMO_CODE_ADMIN_REJECTIONS,
    REGISTER_LATE_MANUAL_PAYMENT_REJECTIONS,
    RETRY_REFUND_PROVIDER_CALLS_REJECTIONS,
    REVOKE_SUBSCRIPTION_REJECTIONS,
    SETTLE_EXTERNAL_CHARGE_REJECTIONS,
    SETTLE_EXTERNAL_REFUND_REJECTIONS,
    SETTLE_REFUND_REMAINDER_REJECTIONS
} from '../../../src/api/billing/rejection-codes';

/** Every billing rejection tuple, by name, for the invariant checks below. */
const TUPLES: Readonly<Record<string, readonly string[]>> = {
    PLAN_MIGRATION_REJECTIONS,
    REVOKE_SUBSCRIPTION_REJECTIONS,
    REGISTER_LATE_MANUAL_PAYMENT_REJECTIONS,
    RETRY_REFUND_PROVIDER_CALLS_REJECTIONS,
    SETTLE_REFUND_REMAINDER_REJECTIONS,
    SETTLE_EXTERNAL_REFUND_REJECTIONS,
    SETTLE_EXTERNAL_CHARGE_REJECTIONS,
    LIFT_RECONCILIATION_MARK_REJECTIONS,
    PROMO_CODE_ADMIN_REJECTIONS
};

describe('HOS-2110 billing rejection code tuples', () => {
    it.each(Object.entries(TUPLES))('%s is non-empty and has no duplicates', (_name, tuple) => {
        // Arrange + Act + Assert
        expect(tuple.length).toBeGreaterThan(0);
        expect(new Set(tuple).size).toBe(tuple.length);
    });

    it('exposes each tuple with the contract length', () => {
        expect(PLAN_MIGRATION_REJECTIONS).toHaveLength(14);
        expect(REVOKE_SUBSCRIPTION_REJECTIONS).toHaveLength(12);
        expect(REGISTER_LATE_MANUAL_PAYMENT_REJECTIONS).toHaveLength(10);
        expect(RETRY_REFUND_PROVIDER_CALLS_REJECTIONS).toHaveLength(10);
        expect(SETTLE_REFUND_REMAINDER_REJECTIONS).toHaveLength(16);
        expect(SETTLE_EXTERNAL_REFUND_REJECTIONS).toHaveLength(15);
        expect(SETTLE_EXTERNAL_CHARGE_REJECTIONS).toHaveLength(6);
        expect(LIFT_RECONCILIATION_MARK_REJECTIONS).toHaveLength(7);
        expect(PROMO_CODE_ADMIN_REJECTIONS).toHaveLength(5);
    });

    it('keeps the spot values the consumers rely on', () => {
        expect(PLAN_MIGRATION_REJECTIONS).toContain('PLAN_MIGRATION_NOT_FOUND');
        expect(PLAN_MIGRATION_REJECTIONS).toContain('PLAN_MIGRATION_ALREADY_CANCELLED');
        expect(REVOKE_SUBSCRIPTION_REJECTIONS).toContain('REFUND_AMOUNT_INVALID');
        expect(REGISTER_LATE_MANUAL_PAYMENT_REJECTIONS).toContain('LOST_RACE');
        expect(RETRY_REFUND_PROVIDER_CALLS_REJECTIONS).toContain('REFUND_CALL_TOO_OLD_TO_RETRY');
        expect(SETTLE_REFUND_REMAINDER_REJECTIONS).toContain('UNCITED_PROVIDER_REFUND_ON_CHARGE');
        expect(SETTLE_EXTERNAL_REFUND_REJECTIONS).toContain('RETAINED_PAYMENT_SUCCESSION_OPEN');
        expect(SETTLE_EXTERNAL_CHARGE_REJECTIONS).toContain('CHARGE_ALREADY_RECORDED');
        expect(LIFT_RECONCILIATION_MARK_REJECTIONS).toContain('MARK_CLOSES_ONLY_BY_REFUND');
        expect(PROMO_CODE_ADMIN_REJECTIONS).toContain('INVALID_PROMO_CODE_INPUT');
    });
});
