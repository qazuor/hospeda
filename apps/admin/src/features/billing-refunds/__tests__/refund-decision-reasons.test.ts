/** Tests for the closed mirror of the action 13 refusals. */

import enBilling from '@repo/i18n/locales/en/admin-billing.json';
import esBilling from '@repo/i18n/locales/es/admin-billing.json';
import ptBilling from '@repo/i18n/locales/pt/admin-billing.json';
import { RefundConfirmationOutcomeSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/errors';
import {
    CONFIRM_OUTCOME_KEYS,
    KNOWN_REFUND_DECISION_REASONS,
    REFUND_DECISION_REASON_KEYS,
    readRefundDecisionReason,
    refundDecisionErrorKey
} from '../refund-decision-reasons';

const resolve = (locale: unknown, key: string): unknown =>
    key
        .split('.')
        .slice(1)
        .reduce((obj: any, part) => obj?.[part], locale);

const conflict = (reason: unknown) =>
    new ApiError('Conflict', { status: 409, body: { error: { reason } } });

describe('HOS-2400 refund decision reasons', () => {
    it('has non-empty copy in es, en and pt for every reason and every outcome', () => {
        const keys = [
            ...Object.values(REFUND_DECISION_REASON_KEYS),
            ...Object.values(CONFIRM_OUTCOME_KEYS)
        ];
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys)
            for (const locale of [esBilling, enBilling, ptBilling])
                expect(String(resolve(locale, key) ?? '').length).toBeGreaterThan(0);
    });

    it('covers every outcome the confirm route can answer', () => {
        expect(Object.keys(CONFIRM_OUTCOME_KEYS).sort()).toEqual(
            [...RefundConfirmationOutcomeSchema.options].sort()
        );
    });

    it('reads a known reason and ignores unknown or non-API errors', () => {
        expect(readRefundDecisionReason({ error: conflict('REFUND_CLOSES_HELD_CHARGE') })).toBe(
            'REFUND_CLOSES_HELD_CHARGE'
        );
        expect(readRefundDecisionReason({ error: conflict('SOMETHING_NEW') })).toBeNull();
        expect(readRefundDecisionReason({ error: new Error('boom') })).toBeNull();
        expect(KNOWN_REFUND_DECISION_REASONS).toContain('REFUND_HAS_PROVIDER_CALLS');
    });

    it('falls back to the server-error and generic messages', () => {
        const server = new ApiError('Boom', { status: 500, body: {} });
        expect(refundDecisionErrorKey({ error: server })).toBe(
            'admin-billing.proposedRefunds.serverError'
        );
        expect(refundDecisionErrorKey({ error: conflict('SOMETHING_NEW') })).toBe(
            'admin-billing.proposedRefunds.genericError'
        );
    });
});
