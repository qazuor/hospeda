/** HOS-1979 / HOS-1992: the Mercado Pago return screen's pure logic. */
import { describe, expect, it, vi } from 'vitest';
import {
    parseReturnSubscriptionId,
    RETURN_POLL_MAX_ATTEMPTS,
    resolveRetryPayerEmail,
    resolveReturnView,
    retryCheckout,
    retryNeedsEmailField,
    shouldPollAgain
} from '@/lib/billing/subscription-return';

const id = '123e4567-e89b-42d3-a456-426614174000';
const optionId = '223e4567-e89b-42d3-a456-426614174000';

describe('parseReturnSubscriptionId', () => {
    it('reads our subscription id', () => {
        expect(parseReturnSubscriptionId({ search: `?subscription=${id}` })).toBe(id);
    });

    it('ignores the provider preapproval_id', () => {
        expect(
            parseReturnSubscriptionId({ search: `?subscription=${id}&preapproval_id=abc` })
        ).toBe(id);
        expect(parseReturnSubscriptionId({ search: '?preapproval_id=abc' })).toBeNull();
    });

    it('survives a provider that glued its query onto ours with a second question mark', () => {
        expect(
            parseReturnSubscriptionId({ search: `?subscription=${id}?preapproval_id=abc` })
        ).toBe(id);
    });

    it('rejects anything that is not a uuid', () => {
        expect(parseReturnSubscriptionId({ search: '?subscription=not-a-uuid' })).toBeNull();
        expect(parseReturnSubscriptionId({ search: '' })).toBeNull();
    });
});

describe('resolveReturnView (three-state decision)', () => {
    it.each([
        ['ACTIVE', 'confirmed'],
        ['CANCEL_SCHEDULED', 'confirmed'],
        ['PENDING_AUTHORIZATION', 'processing'],
        ['CHARGE_DECLINED', 'rejected'],
        ['ABANDONED', 'closed'],
        ['CANCELLED', 'closed']
    ] as const)('%s renders %s', (status, expected) => {
        expect(resolveReturnView({ status, pollsExhausted: false })).toBe(expected);
    });

    it('turns a pending attempt into stillProcessing once the bounded poll ends', () => {
        expect(resolveReturnView({ status: 'PENDING_AUTHORIZATION', pollsExhausted: true })).toBe(
            'stillProcessing'
        );
    });

    it('keeps a rejection a rejection even after polling ended', () => {
        expect(resolveReturnView({ status: 'CHARGE_DECLINED', pollsExhausted: true })).toBe(
            'rejected'
        );
    });

    it('never claims success for an unreadable or unknown status', () => {
        expect(resolveReturnView({ status: null, pollsExhausted: false })).toBe('unknown');
        expect(resolveReturnView({ status: 'trialing', pollsExhausted: false })).toBe('unknown');
        expect(resolveReturnView({ status: 'SUSPENDED', pollsExhausted: false })).toBe('unknown');
    });
});

describe('shouldPollAgain', () => {
    it('polls only while processing and under the cap', () => {
        expect(shouldPollAgain({ view: 'processing', attempt: 0 })).toBe(true);
        expect(shouldPollAgain({ view: 'processing', attempt: RETURN_POLL_MAX_ATTEMPTS - 1 })).toBe(
            true
        );
        expect(shouldPollAgain({ view: 'processing', attempt: RETURN_POLL_MAX_ATTEMPTS })).toBe(
            false
        );
    });

    it.each([
        'confirmed',
        'rejected',
        'closed',
        'unknown',
        'stillProcessing'
    ] as const)('never polls in %s', (view) => {
        expect(shouldPollAgain({ view, attempt: 0 })).toBe(false);
    });
});

describe('retryCheckout', () => {
    it('starts exactly one new checkout for the same option and redirects', async () => {
        const start = vi.fn().mockResolvedValue({
            ok: true,
            data: { checkoutUrl: 'https://www.mercadopago.com.ar/subscriptions/checkout?x=1' }
        });

        const outcome = await retryCheckout({
            start,
            billingOptionId: optionId,
            payerEmail: 'a@b.com'
        });

        expect(start).toHaveBeenCalledTimes(1);
        expect(start).toHaveBeenCalledWith({ billingOptionId: optionId, payerEmail: 'a@b.com' });
        expect(outcome).toEqual({
            kind: 'redirect',
            url: 'https://www.mercadopago.com.ar/subscriptions/checkout?x=1'
        });
    });

    it('surfaces a throttled provider as a message and does not call again (HOS-1968)', async () => {
        const start = vi.fn().mockResolvedValue({
            ok: false,
            error: { status: 503, reason: 'PROVIDER_BUSY' }
        });

        const outcome = await retryCheckout({
            start,
            billingOptionId: optionId,
            payerEmail: 'a@b.com'
        });

        expect(start).toHaveBeenCalledTimes(1);
        expect(outcome.kind).toBe('rejected');
        if (outcome.kind === 'rejected') {
            expect(outcome.rejection.reason).toBe('PROVIDER_BUSY');
            expect(outcome.rejection.messageKey).toBe(
                'billing.checkout.signup.rejection.providerBusy'
            );
        }
    });

    it('does not retry when the call throws', async () => {
        const start = vi.fn().mockRejectedValue(new Error('network'));

        const outcome = await retryCheckout({
            start,
            billingOptionId: optionId,
            payerEmail: 'a@b.com'
        });

        expect(start).toHaveBeenCalledTimes(1);
        expect(outcome.kind).toBe('rejected');
    });

    it('refuses an unsafe checkout url instead of navigating to it', async () => {
        const start = vi
            .fn()
            .mockResolvedValue({ ok: true, data: { checkoutUrl: 'javascript:alert(1)' } });

        const outcome = await retryCheckout({
            start,
            billingOptionId: optionId,
            payerEmail: 'a@b.com'
        });

        expect(outcome.kind).toBe('rejected');
    });
});

describe('retry payer email (HOS-1890 declared email)', () => {
    it('reuses the declared email and does not need the field', () => {
        expect(retryNeedsEmailField({ declaredPayerEmail: 'mp@example.test' })).toBe(false);
        expect(
            resolveRetryPayerEmail({ declaredPayerEmail: 'mp@example.test', typed: 'other@x.test' })
        ).toEqual({ ok: true, email: 'mp@example.test' });
    });

    it('asks for the field when none is stored or the stored one is unusable', () => {
        expect(retryNeedsEmailField({ declaredPayerEmail: null })).toBe(true);
        expect(retryNeedsEmailField({ declaredPayerEmail: 'garbage' })).toBe(true);
        expect(
            resolveRetryPayerEmail({ declaredPayerEmail: null, typed: 'typed@example.test' })
        ).toEqual({ ok: true, email: 'typed@example.test' });
        expect(resolveRetryPayerEmail({ declaredPayerEmail: null, typed: 'nope' }).ok).toBe(false);
    });
});
