/**
 * Contract tests for BILLING_EVENT_TYPES constants (SPEC-147 T-002 + T-010, SPEC-148 T-004).
 *
 * These tests treat the string values as a stable contract: the values are
 * persisted in billing_subscription_events rows, so any rename would corrupt
 * historical data. Pin the literals here so a rename fails CI immediately.
 *
 * All 25 types are asserted (16 pre-existing + 3 added by SPEC-147 T-002/T-009
 * + 1 added by SPEC-147 T-010 + 2 added by SPEC-148 T-004 + 1 added by HOS-171
 * + 1 added by HOS-232 (USER_UNCANCELED)). H-137's
 * TRIAL_NOT_GRANTED_BY_PROVIDER was retired by HOS-1012 T-027.
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

        it('the total number of event types is 56', () => {
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
            // REACTIVATION_SUPERSESSION_COMPLETED) = 44, + 2 (HOS-180:
            // ADMIN_SUBSCRIPTION_COURTESY_GRANTED, COURTESY_WINDOW_ENDED) = 46,
            // + 1 (HOS-1012 T-010: TRIAL_EXPIRED, the local-expiry dedup guard
            // — added in that task WITHOUT bumping this count, which left this
            // assertion red on the branch until T-016 hit it)
            // + 9 (HOS-1012 T-016: the nine TRIAL_SERIES_NOTIF_* dedup guards,
            // one per send of the trial email series — nine and not one,
            // because dedup keys on `(subscription_id, event_type)` and an
            // offset living in metadata could not be part of that index) = 56,
            // + 1 (HOS-1012 T-022: TRIAL_SUPERSEDED_BY_PAID — the audit row for
            // a trial ended by conversion, kept distinct from TRIAL_EXPIRED
            // because the win-back cohort query joins on THAT event and would
            // otherwise mail the customer who just paid) = 57,
            // − 1 (HOS-1012 T-027: TRIAL_NOT_GRANTED_BY_PROVIDER, unreachable
            // once no checkout promises a trial for a charge to break — a
            // removal trips this frozen count exactly as an addition does) = 56.
            expect(Object.keys(BILLING_EVENT_TYPES)).toHaveLength(56);
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

    describe('H-137 retired event type (HOS-1012 T-027)', () => {
        it('TRIAL_NOT_GRANTED_BY_PROVIDER is no longer exported', () => {
            // Retired, not renamed. Nothing in code may write it again, so the
            // key must be absent — not present with a different value. The
            // frozen count above catches the arithmetic; this catches a
            // reintroduction that keeps the count right by dropping another.
            expect(Object.keys(BILLING_EVENT_TYPES)).not.toContain('TRIAL_NOT_GRANTED_BY_PROVIDER');
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
