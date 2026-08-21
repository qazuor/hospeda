/**
 * Contract tests for BILLING_EVENT_TYPES constants (SPEC-147 T-002 + T-010, SPEC-148 T-004).
 *
 * These tests treat the string values as a stable contract: the values are
 * persisted in billing_subscription_events rows, so any rename would corrupt
 * historical data. Pin the literals here so a rename fails CI immediately.
 *
 * All 25 types are asserted (16 pre-existing + 3 added by SPEC-147 T-002/T-009
 * + 1 added by SPEC-147 T-010 + 2 added by SPEC-148 T-004 + 1 added by HOS-171
 * + 1 added by HOS-232 (USER_UNCANCELED) + 1 added by H-137
 * (TRIAL_NOT_GRANTED_BY_PROVIDER)).
 */

import { describe, expect, it } from 'vitest';
import type { BillingEventType } from '../../src/services/billing/constants.js';
import { BILLING_EVENT_TYPES } from '../../src/services/billing/constants.js';

describe('BILLING_EVENT_TYPES', () => {
    describe('pre-existing event types — stable contract values', () => {
        it('ADDON_RECALC_COMPLETED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.ADDON_RECALC_COMPLETED).toBe('ADDON_RECALC_COMPLETED');
        });

        it('ADDON_REVOCATIONS_PENDING has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.ADDON_REVOCATIONS_PENDING).toBe('ADDON_REVOCATIONS_PENDING');
        });

        it('PLAN_CHANGE_LOCAL_FAILED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.PLAN_CHANGE_LOCAL_FAILED).toBe('PLAN_CHANGE_LOCAL_FAILED');
        });

        it('PLAN_CHANGE_MP_PROPAGATION_FAILED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.PLAN_CHANGE_MP_PROPAGATION_FAILED).toBe(
                'PLAN_CHANGE_MP_PROPAGATION_FAILED'
            );
        });

        it('ADDON_EXPIRED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.ADDON_EXPIRED).toBe('ADDON_EXPIRED');
        });

        it('ADDON_LIMIT_RECALCULATED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.ADDON_LIMIT_RECALCULATED).toBe('ADDON_LIMIT_RECALCULATED');
        });

        it('DUNNING_ATTEMPT_CREATED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.DUNNING_ATTEMPT_CREATED).toBe('DUNNING_ATTEMPT_CREATED');
        });

        it('DUNNING_ATTEMPT_SUCCEEDED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.DUNNING_ATTEMPT_SUCCEEDED).toBe('DUNNING_ATTEMPT_SUCCEEDED');
        });

        it('DUNNING_ATTEMPT_FAILED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.DUNNING_ATTEMPT_FAILED).toBe('DUNNING_ATTEMPT_FAILED');
        });

        it('PROMO_CODE_REDEEMED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.PROMO_CODE_REDEEMED).toBe('PROMO_CODE_REDEEMED');
        });

        it('PROMO_CODE_EXPIRED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.PROMO_CODE_EXPIRED).toBe('PROMO_CODE_EXPIRED');
        });

        it('NOTIFICATION_SCHEDULED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.NOTIFICATION_SCHEDULED).toBe('NOTIFICATION_SCHEDULED');
        });

        it('TRIAL_BLOCKED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.TRIAL_BLOCKED).toBe('TRIAL_BLOCKED');
        });

        it('TRIAL_RECONCILED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.TRIAL_RECONCILED).toBe('TRIAL_RECONCILED');
        });

        it('REACTIVATION_AUDIT_FAILED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.REACTIVATION_AUDIT_FAILED).toBe('REACTIVATION_AUDIT_FAILED');
        });

        it('ADDON_REVOCATION_FAILED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.ADDON_REVOCATION_FAILED).toBe('ADDON_REVOCATION_FAILED');
        });

        it('TRIAL_PRE_END_NOTIF_D3 has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.TRIAL_PRE_END_NOTIF_D3).toBe('TRIAL_PRE_END_NOTIF_D3');
        });

        it('TRIAL_PRE_END_NOTIF_D1 has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.TRIAL_PRE_END_NOTIF_D1).toBe('TRIAL_PRE_END_NOTIF_D1');
        });
    });

    describe('SPEC-147 new event types — stable contract values', () => {
        it('USER_CANCELED is exported with the exact string value "USER_CANCELED"', () => {
            expect(BILLING_EVENT_TYPES.USER_CANCELED).toBe('USER_CANCELED');
        });

        it('FINALIZE_CANCELLED_SUB is exported with the exact string value "FINALIZE_CANCELLED_SUB"', () => {
            expect(BILLING_EVENT_TYPES.FINALIZE_CANCELLED_SUB).toBe('FINALIZE_CANCELLED_SUB');
        });

        it('SUBSCRIPTION_ACCESS_ENDING_NOTIF is exported with the exact string value "SUBSCRIPTION_ACCESS_ENDING_NOTIF" (T-010)', () => {
            expect(BILLING_EVENT_TYPES.SUBSCRIPTION_ACCESS_ENDING_NOTIF).toBe(
                'SUBSCRIPTION_ACCESS_ENDING_NOTIF'
            );
        });
    });

    describe('BillingEventType union', () => {
        it('USER_CANCELED is assignable to BillingEventType', () => {
            const value: BillingEventType = BILLING_EVENT_TYPES.USER_CANCELED;
            expect(value).toBe('USER_CANCELED');
        });

        it('FINALIZE_CANCELLED_SUB is assignable to BillingEventType', () => {
            const value: BillingEventType = BILLING_EVENT_TYPES.FINALIZE_CANCELLED_SUB;
            expect(value).toBe('FINALIZE_CANCELLED_SUB');
        });

        it('SUBSCRIPTION_ACCESS_ENDING_NOTIF is assignable to BillingEventType', () => {
            const value: BillingEventType = BILLING_EVENT_TYPES.SUBSCRIPTION_ACCESS_ENDING_NOTIF;
            expect(value).toBe('SUBSCRIPTION_ACCESS_ENDING_NOTIF');
        });

        it('PLAN_DISABLED_BY_ADMIN is assignable to BillingEventType', () => {
            const value: BillingEventType = BILLING_EVENT_TYPES.PLAN_DISABLED_BY_ADMIN;
            expect(value).toBe('PLAN_DISABLED_BY_ADMIN');
        });

        it('PLAN_DISABLED_MIGRATION is assignable to BillingEventType', () => {
            const value: BillingEventType = BILLING_EVENT_TYPES.PLAN_DISABLED_MIGRATION;
            expect(value).toBe('PLAN_DISABLED_MIGRATION');
        });

        it('USER_UNCANCELED is assignable to BillingEventType', () => {
            const value: BillingEventType = BILLING_EVENT_TYPES.USER_UNCANCELED;
            expect(value).toBe('USER_UNCANCELED');
        });

        it('the total number of event types is 44', () => {
            // 25 (this test's original baseline) + 5 (HOS-657 refund/admin-cancel/
            // preapproval-expiry writers: PAYMENT_PARTIAL_REFUND,
            // PAYMENT_FULL_REFUND, PAYMENT_FULL_REFUND_NO_TRANSITION,
            // ADMIN_SUBSCRIPTION_CANCELLED, SUBSCRIPTION_EXPIRED_WITHOUT_PREAPPROVAL)
            // + 14 (HOS-657 remaining writers: ADMIN_PLAN_CHANGED,
            // ADMIN_TRIAL_EXTENDED, ADMIN_SUBSCRIPTION_PAUSED,
            // ADMIN_SUBSCRIPTION_RESUMED, HOST_SUBSCRIPTION_PAUSED,
            // HOST_SUBSCRIPTION_RESUMED, WEBHOOK_SUBSCRIPTION_ACTIVATED,
            // WEBHOOK_SUBSCRIPTION_TRIALING, WEBHOOK_SUBSCRIPTION_PAUSED,
            // WEBHOOK_SUBSCRIPTION_CANCELLED, WEBHOOK_SUBSCRIPTION_EXPIRED,
            // WEBHOOK_SUBSCRIPTION_PAST_DUE, WEBHOOK_SUBSCRIPTION_STATUS_OTHER,
            // REACTIVATION_SUPERSESSION_COMPLETED) = 44.
            expect(Object.keys(BILLING_EVENT_TYPES)).toHaveLength(44);
        });
    });

    describe('HOS-657 new event types — stable contract values', () => {
        it('ADMIN_PLAN_CHANGED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.ADMIN_PLAN_CHANGED).toBe('ADMIN_PLAN_CHANGED');
        });

        it('ADMIN_TRIAL_EXTENDED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.ADMIN_TRIAL_EXTENDED).toBe('ADMIN_TRIAL_EXTENDED');
        });

        it('ADMIN_SUBSCRIPTION_PAUSED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.ADMIN_SUBSCRIPTION_PAUSED).toBe('ADMIN_SUBSCRIPTION_PAUSED');
        });

        it('ADMIN_SUBSCRIPTION_RESUMED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.ADMIN_SUBSCRIPTION_RESUMED).toBe(
                'ADMIN_SUBSCRIPTION_RESUMED'
            );
        });

        it('HOST_SUBSCRIPTION_PAUSED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.HOST_SUBSCRIPTION_PAUSED).toBe('HOST_SUBSCRIPTION_PAUSED');
        });

        it('HOST_SUBSCRIPTION_RESUMED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.HOST_SUBSCRIPTION_RESUMED).toBe('HOST_SUBSCRIPTION_RESUMED');
        });

        it('WEBHOOK_SUBSCRIPTION_ACTIVATED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_ACTIVATED).toBe(
                'WEBHOOK_SUBSCRIPTION_ACTIVATED'
            );
        });

        it('WEBHOOK_SUBSCRIPTION_TRIALING has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_TRIALING).toBe(
                'WEBHOOK_SUBSCRIPTION_TRIALING'
            );
        });

        it('WEBHOOK_SUBSCRIPTION_PAUSED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_PAUSED).toBe(
                'WEBHOOK_SUBSCRIPTION_PAUSED'
            );
        });

        it('WEBHOOK_SUBSCRIPTION_CANCELLED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_CANCELLED).toBe(
                'WEBHOOK_SUBSCRIPTION_CANCELLED'
            );
        });

        it('WEBHOOK_SUBSCRIPTION_EXPIRED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_EXPIRED).toBe(
                'WEBHOOK_SUBSCRIPTION_EXPIRED'
            );
        });

        it('WEBHOOK_SUBSCRIPTION_PAST_DUE has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_PAST_DUE).toBe(
                'WEBHOOK_SUBSCRIPTION_PAST_DUE'
            );
        });

        it('WEBHOOK_SUBSCRIPTION_STATUS_OTHER has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_STATUS_OTHER).toBe(
                'WEBHOOK_SUBSCRIPTION_STATUS_OTHER'
            );
        });

        it('REACTIVATION_SUPERSESSION_COMPLETED has the expected string value', () => {
            expect(BILLING_EVENT_TYPES.REACTIVATION_SUPERSESSION_COMPLETED).toBe(
                'REACTIVATION_SUPERSESSION_COMPLETED'
            );
        });
    });

    describe('H-137 new event type — stable contract value', () => {
        it('TRIAL_NOT_GRANTED_BY_PROVIDER is exported with the exact string value', () => {
            // Persisted on billing_subscription_events rows for every customer
            // charged instead of receiving the trial they were shown, so a
            // rename would orphan the audit trail of a money incident.
            expect(BILLING_EVENT_TYPES.TRIAL_NOT_GRANTED_BY_PROVIDER).toBe(
                'TRIAL_NOT_GRANTED_BY_PROVIDER'
            );
        });

        it('TRIAL_NOT_GRANTED_BY_PROVIDER is assignable to BillingEventType', () => {
            const value: BillingEventType = BILLING_EVENT_TYPES.TRIAL_NOT_GRANTED_BY_PROVIDER;
            expect(value).toBe('TRIAL_NOT_GRANTED_BY_PROVIDER');
        });

        it('is distinct from TRIAL_RECONCILED', () => {
            // The whole point of minting a new type: a broken promise must not
            // hide inside ordinary conversion traffic.
            expect(BILLING_EVENT_TYPES.TRIAL_NOT_GRANTED_BY_PROVIDER).not.toBe(
                BILLING_EVENT_TYPES.TRIAL_RECONCILED
            );
        });
    });

    describe('HOS-232 new event type — stable contract value', () => {
        it('USER_UNCANCELED is exported with the exact string value "USER_UNCANCELED"', () => {
            expect(BILLING_EVENT_TYPES.USER_UNCANCELED).toBe('USER_UNCANCELED');
        });
    });

    describe('SPEC-148 new event types — stable contract values', () => {
        it('PLAN_DISABLED_BY_ADMIN is exported with the exact string value "PLAN_DISABLED_BY_ADMIN"', () => {
            expect(BILLING_EVENT_TYPES.PLAN_DISABLED_BY_ADMIN).toBe('PLAN_DISABLED_BY_ADMIN');
        });

        it('PLAN_DISABLED_MIGRATION is exported with the exact string value "PLAN_DISABLED_MIGRATION"', () => {
            expect(BILLING_EVENT_TYPES.PLAN_DISABLED_MIGRATION).toBe('PLAN_DISABLED_MIGRATION');
        });
    });
});
