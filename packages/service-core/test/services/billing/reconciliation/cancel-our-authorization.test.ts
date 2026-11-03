import { type PaymentProvider, PaymentProviderError } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it, vi } from 'vitest';

const { logError, logWarn } = vi.hoisted(() => ({ logError: vi.fn(), logWarn: vi.fn() }));
vi.mock('@repo/logger', () => ({
    createLogger: () => ({ error: logError, warn: logWarn, info: vi.fn(), debug: vi.fn() })
}));

import {
    cancelOurAuthorization,
    SWEEP_CANCEL_RETRY
} from '../../../../src/services/billing/reconciliation/cancel-our-authorization';
import type {
    BeforeCancelNotice,
    BeforeCancelNoticeStatus
} from '../../../../src/services/billing/subscription/start-subscription.service';

function movableClock() {
    let at = new Date('2026-10-11T12:00:00.000Z').getTime();
    return {
        now: () => new Date(at),
        advance: (ms: number) => {
            at += ms;
        }
    };
}

async function setup(options: { readonly cancelled?: boolean } = {}) {
    const clock = movableClock();
    const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
    const { authorizationId } = await fake.authorize({
        reference: `legacy-${crypto.randomUUID()}`,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'cancel our authorization unit test',
        returnUrl: 'https://example.test/return',
        payerEmail: `payer-${crypto.randomUUID()}@example.test`
    });
    await fake.approve({ authorizationId });
    if (options.cancelled) await fake.cancel({ authorizationId });
    const calls: string[] = [];
    const read = vi.spyOn(fake, 'readAuthorization');
    read.mockImplementation(async (input) => {
        calls.push('read');
        return FakePaymentProvider.prototype.readAuthorization.call(fake, input);
    });
    const cancel = vi.spyOn(fake, 'cancel');
    cancel.mockImplementation(async (input) => {
        calls.push('cancel');
        return FakePaymentProvider.prototype.cancel.call(fake, input);
    });
    return { clock, fake, provider: fake as unknown as PaymentProvider, authorizationId, calls };
}

function notice(status: BeforeCancelNoticeStatus, calls: string[]) {
    const beforeCancel = vi.fn<BeforeCancelNotice['beforeCancel']>(async () => {
        calls.push('notice');
        return status;
    });
    return { beforeCancel };
}

describe('cancelOurAuthorization (AC:B11:3, AC:B11:6)', () => {
    it('does not call nor ask for the notice when the re-read already sees it cancelled', async () => {
        const { provider, clock, authorizationId, calls } = await setup({ cancelled: true });
        const beforeCancelNotice = notice('SENT', calls);
        const result = await cancelOurAuthorization(
            {
                subscriptionId: crypto.randomUUID(),
                userId: crypto.randomUUID(),
                authorizationId,
                kind: 'AUTHORIZATION_EXPIRED'
            },
            { provider, clock, beforeCancelNotice }
        );
        expect(result).toEqual({ outcome: 'ALREADY_CANCELLED' });
        expect(calls).toEqual(['read']);
        expect(beforeCancelNotice.beforeCancel).not.toHaveBeenCalled();
    });

    it('defers the call while the notice is NOT_YET_SENT', async () => {
        const { provider, clock, authorizationId, calls } = await setup();
        const result = await cancelOurAuthorization(
            {
                subscriptionId: crypto.randomUUID(),
                userId: crypto.randomUUID(),
                authorizationId,
                kind: 'AUTHORIZATION_EXPIRED'
            },
            { provider, clock, beforeCancelNotice: notice('NOT_YET_SENT', calls) }
        );
        expect(result).toEqual({ outcome: 'NOTICE_PENDING' });
        expect(calls).toEqual(['read', 'notice']);
    });

    it.each([
        'NO_RECIPIENT',
        'DELIVERY_EXHAUSTED'
    ] as const)('calls anyway when the notice is %s, in the order notice, cancel, re-read', async (status) => {
        const { provider, clock, authorizationId, calls } = await setup();
        const subscriptionId = crypto.randomUUID();
        const userId = crypto.randomUUID();
        const beforeCancelNotice = notice(status, calls);
        const result = await cancelOurAuthorization(
            { subscriptionId, userId, authorizationId, kind: 'AUTHORIZATION_EXPIRED' },
            { provider, clock, beforeCancelNotice }
        );
        expect(result).toEqual({ outcome: 'CONFIRMED' });
        expect(calls).toEqual(['read', 'notice', 'cancel', 'read']);
        expect(beforeCancelNotice.beforeCancel).toHaveBeenCalledWith({
            subscriptionId,
            userId,
            kind: 'AUTHORIZATION_EXPIRED'
        });
    });

    it('passes the notice kind to beforeCancel when given, with the default occurrence', async () => {
        const { provider, clock, authorizationId, calls } = await setup();
        const subscriptionId = crypto.randomUUID();
        const userId = crypto.randomUUID();
        const beforeCancelNotice = notice('SENT', calls);
        await cancelOurAuthorization(
            { subscriptionId, userId, authorizationId, kind: 'TOURIST_VIP_INHERITED' },
            { provider, clock, beforeCancelNotice }
        );
        expect(beforeCancelNotice.beforeCancel).toHaveBeenCalledTimes(1);
        expect(beforeCancelNotice.beforeCancel.mock.calls[0]?.[0]).toStrictEqual({
            subscriptionId,
            userId,
            kind: 'TOURIST_VIP_INHERITED'
        });
    });

    it('HOS-1545 AC:B5:27 — passes ADDON_CANCELLED to beforeCancel as is', async () => {
        // Arrange
        const { provider, clock, authorizationId, calls } = await setup();
        const subscriptionId = crypto.randomUUID();
        const userId = crypto.randomUUID();
        const beforeCancelNotice = notice('SENT', calls);

        // Act
        const result = await cancelOurAuthorization(
            { subscriptionId, userId, authorizationId, kind: 'ADDON_CANCELLED' },
            { provider, clock, beforeCancelNotice }
        );

        // Assert
        expect(result).toEqual({ outcome: 'CONFIRMED' });
        expect(beforeCancelNotice.beforeCancel).toHaveBeenCalledTimes(1);
        expect(beforeCancelNotice.beforeCancel.mock.calls[0]?.[0]).toStrictEqual({
            subscriptionId,
            userId,
            kind: 'ADDON_CANCELLED'
        });
        expect(calls).toEqual(['read', 'notice', 'cancel', 'read']);
    });

    it('passes AUTHORIZATION_EXPIRED (S3) to beforeCancel as is', async () => {
        const { provider, clock, authorizationId, calls } = await setup();
        const subscriptionId = crypto.randomUUID();
        const userId = crypto.randomUUID();
        const beforeCancelNotice = notice('SENT', calls);
        await cancelOurAuthorization(
            { subscriptionId, userId, authorizationId, kind: 'AUTHORIZATION_EXPIRED' },
            { provider, clock, beforeCancelNotice }
        );
        const sent = beforeCancelNotice.beforeCancel.mock.calls[0]?.[0];
        expect(sent).toStrictEqual({ subscriptionId, userId, kind: 'AUTHORIZATION_EXPIRED' });
    });

    it('without a recipient asks for no notice and calls', async () => {
        const { provider, clock, authorizationId, calls } = await setup();
        const beforeCancelNotice = notice('NOT_YET_SENT', calls);
        const result = await cancelOurAuthorization(
            { subscriptionId: crypto.randomUUID(), userId: null, authorizationId, kind: null },
            { provider, clock, beforeCancelNotice }
        );
        expect(result).toEqual({ outcome: 'CONFIRMED' });
        expect(beforeCancelNotice.beforeCancel).not.toHaveBeenCalled();
        expect(calls).toEqual(['read', 'cancel', 'read']);
    });

    it('reports CALL_FAILED when cancel rejects, without re-reading or throwing', async () => {
        const { fake, provider, clock, authorizationId, calls } = await setup();
        vi.spyOn(fake, 'cancel').mockImplementation(async () => {
            calls.push('cancel');
            throw new Error('provider body must not be logged');
        });
        const result = await cancelOurAuthorization(
            { subscriptionId: crypto.randomUUID(), userId: null, authorizationId, kind: null },
            { provider, clock }
        );
        expect(result).toEqual({ outcome: 'CALL_FAILED' });
        expect(calls).toEqual(['read', 'cancel']);
    });

    it('reports SENT_UNCONFIRMED when the re-read after still sees it alive', async () => {
        const { fake, provider, clock, authorizationId, calls } = await setup();
        vi.spyOn(fake, 'cancel').mockImplementation(async () => {
            calls.push('cancel');
            return { accepted: true as const, resourceId: authorizationId };
        });
        const result = await cancelOurAuthorization(
            { subscriptionId: crypto.randomUUID(), userId: null, authorizationId, kind: null },
            { provider, clock }
        );
        expect(result).toEqual({ outcome: 'SENT_UNCONFIRMED' });
        expect(calls).toEqual(['read', 'cancel', 'read']);
    });

    it('reports SENT_UNCONFIRMED when the re-read after fails', async () => {
        const { fake, provider, clock, authorizationId } = await setup();
        const read = vi.spyOn(fake, 'readAuthorization');
        const original = FakePaymentProvider.prototype.readAuthorization;
        read.mockImplementationOnce(async (input) => original.call(fake, input));
        read.mockRejectedValueOnce(new Error('read failed'));
        const result = await cancelOurAuthorization(
            { subscriptionId: crypto.randomUUID(), userId: null, authorizationId, kind: null },
            { provider, clock }
        );
        expect(result).toEqual({ outcome: 'SENT_UNCONFIRMED' });
    });

    it('a failed read before the call calls nothing and reports CALL_FAILED', async () => {
        const { fake, provider, clock, authorizationId, calls } = await setup();
        vi.spyOn(fake, 'readAuthorization').mockRejectedValueOnce(new Error('read failed'));
        const result = await cancelOurAuthorization(
            { subscriptionId: crypto.randomUUID(), userId: null, authorizationId, kind: null },
            { provider, clock }
        );
        expect(result).toEqual({ outcome: 'CALL_FAILED' });
        expect(calls).not.toContain('cancel');
    });

    it('a fresh prior read replaces the first read', async () => {
        const { fake, provider, clock, authorizationId, calls } = await setup();
        const act = { kind: 'decision' as const, startedAt: clock.now() };
        const read = await FakePaymentProvider.prototype.readAuthorization.call(fake, {
            authorizationId
        });
        const result = await cancelOurAuthorization(
            {
                subscriptionId: crypto.randomUUID(),
                userId: null,
                authorizationId,
                kind: null,
                prior: { read, act }
            },
            { provider, clock }
        );
        expect(result).toEqual({ outcome: 'CONFIRMED' });
        expect(calls).toEqual(['cancel', 'read']);
    });

    it('rejects a prior read older than its act with STALE_READ and calls nothing', async () => {
        const { fake, provider, clock, authorizationId, calls } = await setup();
        const read = await FakePaymentProvider.prototype.readAuthorization.call(fake, {
            authorizationId
        });
        clock.advance(1000);
        const act = { kind: 'decision' as const, startedAt: clock.now() };
        await expect(
            cancelOurAuthorization(
                {
                    subscriptionId: crypto.randomUUID(),
                    userId: null,
                    authorizationId,
                    kind: null,
                    prior: { read, act }
                },
                { provider, clock }
            )
        ).rejects.toMatchObject({ reason: 'STALE_READ' });
        expect(calls).toEqual([]);
    });
});

describe('TEST:1683:5 AC:1683:3 a recipient without a kind fails closed', () => {
    it('asks for no notice, calls nothing and reports CALL_FAILED', async () => {
        // Arrange
        const { provider, clock, authorizationId, calls } = await setup();
        const beforeCancelNotice = notice('SENT', calls);

        // Act
        const result = await cancelOurAuthorization(
            {
                subscriptionId: crypto.randomUUID(),
                userId: crypto.randomUUID(),
                authorizationId,
                kind: null
            },
            { provider, clock, beforeCancelNotice }
        );

        // Assert
        expect(result).toStrictEqual({ outcome: 'CALL_FAILED' });
        expect(beforeCancelNotice.beforeCancel).not.toHaveBeenCalled();
        expect(calls).not.toContain('cancel');
    });
});

function rateLimited(retryAfterSeconds?: number): PaymentProviderError {
    return new PaymentProviderError({
        code: 'REJECTED',
        capability: 'cancel',
        message: 'Mercado Pago request failed (429)',
        cause: { status: 429, body: { message: 'too many requests' } },
        transient: { kind: 'RATE_LIMITED', ...(retryAfterSeconds ? { retryAfterSeconds } : {}) }
    });
}

function serverError(): PaymentProviderError {
    return new PaymentProviderError({
        code: 'UNAVAILABLE',
        capability: 'cancel',
        message: 'Mercado Pago request failed (503)',
        cause: { status: 503, body: {} },
        transient: { kind: 'UNAVAILABLE' }
    });
}

function refusal(): PaymentProviderError {
    return new PaymentProviderError({
        code: 'REJECTED',
        capability: 'cancel',
        message: 'Mercado Pago request failed (400)',
        cause: { status: 400, body: { message: 'bad' } }
    });
}

async function run(
    context: Awaited<ReturnType<typeof setup>>,
    options: {
        readonly retry?: typeof SWEEP_CANCEL_RETRY;
        readonly sleep?: (ms: number) => Promise<void>;
    }
) {
    const { provider, clock, authorizationId } = context;
    return cancelOurAuthorization(
        {
            subscriptionId: crypto.randomUUID(),
            userId: null,
            authorizationId,
            kind: null,
            ...(options.retry ? { retry: options.retry } : {})
        },
        { provider, clock, ...(options.sleep ? { sleep: options.sleep } : {}) }
    );
}

describe('HOS-1995 the sweep cancel call survives a provider throttle', () => {
    it('retries a 429 with the 2s backoff in the same pass and confirms', async () => {
        const ctx = await setup();
        const real = FakePaymentProvider.prototype.cancel.bind(ctx.fake);
        const cancel = vi.spyOn(ctx.fake, 'cancel');
        cancel
            .mockRejectedValueOnce(rateLimited())
            .mockImplementation(async (input) => real(input));
        const sleep = vi.fn(async (_ms: number) => undefined);
        const result = await run(ctx, { retry: SWEEP_CANCEL_RETRY, sleep });
        expect(result).toEqual({ outcome: 'CONFIRMED' });
        expect(cancel).toHaveBeenCalledTimes(2);
        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2000]);
    });

    it('waits 2s then 4s and stops after three attempts with CALL_FAILED', async () => {
        const ctx = await setup();
        const cancel = vi.spyOn(ctx.fake, 'cancel').mockRejectedValue(rateLimited());
        const sleep = vi.fn(async (_ms: number) => undefined);
        const result = await run(ctx, { retry: SWEEP_CANCEL_RETRY, sleep });
        expect(result).toEqual({ outcome: 'CALL_FAILED' });
        expect(cancel).toHaveBeenCalledTimes(3);
        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 4000]);
    });

    it('honours Retry-After below the cap and ignores one above it (10s cap)', async () => {
        const ctx = await setup();
        vi.spyOn(ctx.fake, 'cancel')
            .mockRejectedValueOnce(rateLimited(3))
            .mockRejectedValueOnce(rateLimited(120))
            .mockRejectedValue(rateLimited());
        const sleep = vi.fn(async (_ms: number) => undefined);
        await run(ctx, { retry: SWEEP_CANCEL_RETRY, sleep });
        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([3000, 10000]);
    });

    it('stops retrying when the next wait would exceed the total budget', async () => {
        const ctx = await setup();
        const cancel = vi.spyOn(ctx.fake, 'cancel').mockRejectedValue(rateLimited());
        const sleep = vi.fn(async (_ms: number) => undefined);
        const result = await run(ctx, {
            retry: { ...SWEEP_CANCEL_RETRY, maxAttempts: 5, totalBudgetMs: 5000 },
            sleep
        });
        expect(result).toEqual({ outcome: 'CALL_FAILED' });
        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2000]);
        expect(cancel).toHaveBeenCalledTimes(2);
    });

    it('retries a 5xx (UNAVAILABLE) and a network error surfaced as transient', async () => {
        const ctx = await setup();
        const network = new PaymentProviderError({
            code: 'UNAVAILABLE',
            capability: 'cancel',
            message: 'fetch failed',
            cause: new TypeError('fetch failed'),
            transient: { kind: 'UNAVAILABLE' }
        });
        const real = FakePaymentProvider.prototype.cancel.bind(ctx.fake);
        const cancel = vi.spyOn(ctx.fake, 'cancel');
        cancel
            .mockRejectedValueOnce(serverError())
            .mockRejectedValueOnce(network)
            .mockImplementation(async (input) => real(input));
        const sleep = vi.fn(async (_ms: number) => undefined);
        const result = await run(ctx, { retry: SWEEP_CANCEL_RETRY, sleep });
        expect(result).toEqual({ outcome: 'CONFIRMED' });
        expect(cancel).toHaveBeenCalledTimes(3);
    });

    it('does not retry a refusal that is not transient', async () => {
        const ctx = await setup();
        const cancel = vi.spyOn(ctx.fake, 'cancel').mockRejectedValue(refusal());
        const sleep = vi.fn(async (_ms: number) => undefined);
        const result = await run(ctx, { retry: SWEEP_CANCEL_RETRY, sleep });
        expect(result).toEqual({ outcome: 'CALL_FAILED' });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(sleep).not.toHaveBeenCalled();
    });

    it('re-reads after transient-then-refused and reports CONFIRMED when already cancelled', async () => {
        const ctx = await setup();
        const real = FakePaymentProvider.prototype.cancel.bind(ctx.fake);
        vi.spyOn(ctx.fake, 'cancel')
            .mockImplementationOnce(async (input) => {
                await real(input);
                throw serverError();
            })
            .mockRejectedValue(refusal());
        const sleep = vi.fn(async (_ms: number) => undefined);
        const result = await run(ctx, { retry: SWEEP_CANCEL_RETRY, sleep });
        expect(result).toEqual({ outcome: 'CONFIRMED' });
    });

    it('reports CALL_FAILED when transient-then-refused and the re-read shows it alive', async () => {
        const ctx = await setup();
        vi.spyOn(ctx.fake, 'cancel')
            .mockRejectedValueOnce(serverError())
            .mockRejectedValue(refusal());
        const result = await run(ctx, { retry: SWEEP_CANCEL_RETRY, sleep: async () => undefined });
        expect(result).toEqual({ outcome: 'CALL_FAILED' });
    });

    it('a caller without a retry policy makes ONE attempt and never sleeps', async () => {
        const ctx = await setup();
        const cancel = vi.spyOn(ctx.fake, 'cancel').mockRejectedValue(rateLimited());
        const sleep = vi.fn(async (_ms: number) => undefined);
        const result = await run(ctx, { sleep });
        expect(result).toEqual({ outcome: 'CALL_FAILED' });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(sleep).not.toHaveBeenCalled();
    });

    it('logs the HTTP status and the sanitized body of the failed cancel and captures it', async () => {
        const ctx = await setup();
        vi.spyOn(ctx.fake, 'cancel').mockRejectedValue(rateLimited(4));
        logError.mockClear();
        await run(ctx, { retry: SWEEP_CANCEL_RETRY, sleep: async () => undefined });
        const call = logError.mock.calls.find(
            ([, label]) => label === 'Our provider authorization could not be cancelled'
        );
        expect(call?.[0]).toMatchObject({
            errorName: 'PaymentProviderError',
            status: 429,
            body: { message: 'too many requests' },
            transientKind: 'RATE_LIMITED',
            attempts: 3
        });
        expect(call?.[2]).toMatchObject({ capture: true });
    });
});
