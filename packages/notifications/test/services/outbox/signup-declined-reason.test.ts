import { describe, expect, it } from 'vitest';
import {
    resolveSignupDeclinedMessage,
    SIGNUP_DECLINED_CAUSE_BY_STATUS_DETAIL
} from '../../../src/services/outbox/signup-declined-reason.js';

describe('TEST:B13a:4 AC:B13a:5 the status_detail map of a declined signup', () => {
    it.each([
        ['cc_rejected_high_risk', 'PROVIDER_RISK'],
        ['payment_method_not_ready', 'PAYMENT_METHOD'],
        ['cc_rejected_insufficient_amount', 'PAYMENT_METHOD'],
        ['cc_rejected_bad_filled_date', 'PAYMENT_METHOD']
    ] as const)('maps %s to %s', (declineReason, cause) => {
        expect(
            resolveSignupDeclinedMessage({ declineReason, successionPredecessor: false }).cause
        ).toBe(cause);
    });

    it.each([
        'cc_rejected_call_for_authorize',
        'constructor',
        '',
        null
    ] as const)('uses UNKNOWN for %s', (declineReason) => {
        expect(
            resolveSignupDeclinedMessage({ declineReason, successionPredecessor: false }).cause
        ).toBe('UNKNOWN');
    });

    it.each([
        ['PROVIDER_RISK', 'cc_rejected_high_risk'],
        ['PAYMENT_METHOD', 'payment_method_not_ready'],
        ['UNKNOWN', 'cc_rejected_call_for_authorize']
    ] as const)('uses the successor checkout retry for %s', (_cause, declineReason) => {
        expect(
            resolveSignupDeclinedMessage({ declineReason, successionPredecessor: true }).retry
        ).toBe('FINISH_SUCCESSOR_CHECKOUT');
    });

    it('uses a new signup retry without a succession predecessor', () => {
        expect(
            resolveSignupDeclinedMessage({
                declineReason: 'cc_rejected_high_risk',
                successionPredecessor: false
            }).retry
        ).toBe('NEW_SIGNUP');
    });

    it('keeps the measured status_detail map frozen to exactly four codes', () => {
        expect(Object.keys(SIGNUP_DECLINED_CAUSE_BY_STATUS_DETAIL).sort()).toEqual([
            'cc_rejected_bad_filled_date',
            'cc_rejected_high_risk',
            'cc_rejected_insufficient_amount',
            'payment_method_not_ready'
        ]);
    });
});
