import { describe, expect, it } from 'vitest';
import {
    evaluateLatePaymentConditions,
    LATE_PAYMENT_FAILED_CONDITION_FIELD,
    type LatePaymentFacts,
    lateRejectionDetail
} from '../../../../src/services/billing/subscription/late-payment-conditions';

const healthy: LatePaymentFacts = {
    status: 'GRACE_PERIOD',
    admittedStatuses: ['GRACE_PERIOD'],
    succeededById: null,
    isPredecessorInSuccession: false,
    hasOtherLivePrincipal: false,
    paymentAmount: { amountMinor: 250000, currency: 'ARS' },
    authorizationAmount: { amountMinor: 250000, currency: 'ARS' },
    paymentCoversUnpaidPeriod: true
};

const evaluate = (overrides: Partial<LatePaymentFacts>) =>
    evaluateLatePaymentConditions({ facts: { ...healthy, ...overrides } });

describe('TEST:B7:4 — the four conditions of 05 §3 (AC:B7:6)', () => {
    it('accepts a late payment when the four conditions hold', () => {
        expect(evaluate({})).toEqual({ ok: true });
    });

    it('condition 1: rejects a status the caller does not admit', () => {
        expect(evaluate({ status: 'ACTIVE' })).toEqual({ ok: false, failedCondition: 1 });
        expect(evaluate({ status: 'SUSPENDED' })).toEqual({ ok: false, failedCondition: 1 });
    });

    it('condition 1: admits SUSPENDED when the caller lists it (S7 reuse)', () => {
        expect(evaluate({ status: 'SUSPENDED', admittedStatuses: ['SUSPENDED'] })).toEqual({
            ok: true
        });
    });

    it('condition 2: rejects a different amount', () => {
        expect(evaluate({ authorizationAmount: { amountMinor: 300000, currency: 'ARS' } })).toEqual(
            { ok: false, failedCondition: 2 }
        );
    });

    it('condition 2: rejects a different currency', () => {
        expect(evaluate({ authorizationAmount: { amountMinor: 250000, currency: 'USD' } })).toEqual(
            { ok: false, failedCondition: 2 }
        );
    });

    it('condition 3: rejects another live principal of the same user and vertical', () => {
        expect(evaluate({ hasOtherLivePrincipal: true })).toEqual({
            ok: false,
            failedCondition: 3
        });
    });

    it('condition 3: rejects a row already succeeded (sucedida_por set)', () => {
        expect(evaluate({ succeededById: crypto.randomUUID() })).toEqual({
            ok: false,
            failedCondition: 3
        });
    });

    it('condition 4: rejects a payment without its covered period (P1 marked a duplicate)', () => {
        expect(evaluate({ paymentCoversUnpaidPeriod: false })).toEqual({
            ok: false,
            failedCondition: 4
        });
    });

    it('D-4 comes first: the predecessor of a succession in progress is retained for S19', () => {
        expect(
            evaluate({
                isPredecessorInSuccession: true,
                hasOtherLivePrincipal: true,
                authorizationAmount: { amountMinor: 1, currency: 'ARS' },
                paymentCoversUnpaidPeriod: false,
                status: 'ACTIVE'
            })
        ).toEqual({ retainedForS19: true });
    });

    it('D-3: a duplicate period is reported as condition 4 even when 2 and 3 also fail', () => {
        expect(
            evaluate({
                paymentCoversUnpaidPeriod: false,
                hasOtherLivePrincipal: true,
                authorizationAmount: { amountMinor: 1, currency: 'ARS' }
            })
        ).toEqual({ ok: false, failedCondition: 4 });
    });

    it('condition 2 is reported before condition 3', () => {
        expect(
            evaluate({
                hasOtherLivePrincipal: true,
                authorizationAmount: { amountMinor: 1, currency: 'ARS' }
            })
        ).toEqual({ ok: false, failedCondition: 2 });
    });
});

describe('TEST:1620:5 lateRejectionDetail (AC:B13a:9, V-3)', () => {
    it.each([
        1,
        2,
        3,
        4,
        null
    ] as const)('records failed condition %s on the event', (failedCondition) => {
        expect(lateRejectionDetail({ failedCondition })).toEqual([
            { field: 'late_payment.failed_condition', new: failedCondition }
        ]);
        expect(LATE_PAYMENT_FAILED_CONDITION_FIELD).toBe('late_payment.failed_condition');
    });
});
