import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it, vi } from 'vitest';
import { cancelOurAuthorization } from '../../../../src/services/billing/reconciliation/cancel-our-authorization';
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
            { subscriptionId: crypto.randomUUID(), userId: crypto.randomUUID(), authorizationId },
            { provider, clock, beforeCancelNotice }
        );
        expect(result).toEqual({ outcome: 'ALREADY_CANCELLED' });
        expect(calls).toEqual(['read']);
        expect(beforeCancelNotice.beforeCancel).not.toHaveBeenCalled();
    });

    it('defers the call while the notice is NOT_YET_SENT', async () => {
        const { provider, clock, authorizationId, calls } = await setup();
        const result = await cancelOurAuthorization(
            { subscriptionId: crypto.randomUUID(), userId: crypto.randomUUID(), authorizationId },
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
            { subscriptionId, userId, authorizationId },
            { provider, clock, beforeCancelNotice }
        );
        expect(result).toEqual({ outcome: 'CONFIRMED' });
        expect(calls).toEqual(['read', 'notice', 'cancel', 'read']);
        expect(beforeCancelNotice.beforeCancel).toHaveBeenCalledWith({ subscriptionId, userId });
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

    it('without a kind sends no kind key to beforeCancel', async () => {
        const { provider, clock, authorizationId, calls } = await setup();
        const subscriptionId = crypto.randomUUID();
        const userId = crypto.randomUUID();
        const beforeCancelNotice = notice('SENT', calls);
        await cancelOurAuthorization(
            { subscriptionId, userId, authorizationId },
            { provider, clock, beforeCancelNotice }
        );
        const sent = beforeCancelNotice.beforeCancel.mock.calls[0]?.[0];
        expect(sent).toStrictEqual({ subscriptionId, userId });
        expect(Object.keys(sent ?? {})).not.toContain('kind');
    });

    it('without a recipient asks for no notice and calls', async () => {
        const { provider, clock, authorizationId, calls } = await setup();
        const beforeCancelNotice = notice('NOT_YET_SENT', calls);
        const result = await cancelOurAuthorization(
            { subscriptionId: crypto.randomUUID(), userId: null, authorizationId },
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
            { subscriptionId: crypto.randomUUID(), userId: null, authorizationId },
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
            { subscriptionId: crypto.randomUUID(), userId: null, authorizationId },
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
            { subscriptionId: crypto.randomUUID(), userId: null, authorizationId },
            { provider, clock }
        );
        expect(result).toEqual({ outcome: 'SENT_UNCONFIRMED' });
    });

    it('a failed read before the call calls nothing and reports CALL_FAILED', async () => {
        const { fake, provider, clock, authorizationId, calls } = await setup();
        vi.spyOn(fake, 'readAuthorization').mockRejectedValueOnce(new Error('read failed'));
        const result = await cancelOurAuthorization(
            { subscriptionId: crypto.randomUUID(), userId: null, authorizationId },
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
                    prior: { read, act }
                },
                { provider, clock }
            )
        ).rejects.toMatchObject({ reason: 'STALE_READ' });
        expect(calls).toEqual([]);
    });
});
