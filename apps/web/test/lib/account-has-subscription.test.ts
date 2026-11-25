import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listMine } = vi.hoisted(() => ({ listMine: vi.fn() }));
vi.mock('@/lib/api/endpoints-protected', () => ({ billingSubscriptionApi: { listMine } }));

const input = { userId: 'owner-a', cookieHeader: 'test-session' };
const response = (subscriptions: unknown[]) => ({
    ok: true,
    data: { subscriptions, deferredCourtesies: [], declinedSignups: [], expiredDeclinedSignups: [] }
});

describe('hasAnySubscription', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.resetAllMocks();
        vi.useFakeTimers();
    });
    afterEach(() => vi.useRealTimers());

    it('caches empty reads for 60 seconds and then retries', async () => {
        const { hasAnySubscription } = await import('@/lib/account-has-subscription');
        listMine.mockResolvedValue(response([]));
        expect(await hasAnySubscription(input)).toBe(false);
        expect(await hasAnySubscription(input)).toBe(false);
        expect(listMine).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(60_001);
        await hasAnySubscription(input);
        expect(listMine).toHaveBeenCalledTimes(2);
        expect(listMine).toHaveBeenCalledWith({ cookieHeader: input.cookieHeader });
    });

    it('isolates users and coalesces concurrent reads', async () => {
        const { hasAnySubscription } = await import('@/lib/account-has-subscription');
        listMine.mockResolvedValue(response([]));
        await Promise.all([hasAnySubscription(input), hasAnySubscription(input)]);
        await hasAnySubscription({ ...input, userId: 'owner-b' });
        expect(listMine).toHaveBeenCalledTimes(2);
    });

    it('returns and caches true for a real subscription response, regardless of status', async () => {
        const { hasAnySubscription } = await import('@/lib/account-has-subscription');
        listMine.mockResolvedValue(
            response([
                {
                    id: '123e4567-e89b-42d3-a456-426614174001',
                    vertical: 'accommodation',
                    status: 'PAUSED',
                    paymentMethod: 'CARD',
                    serviceEndsAt: null,
                    graceEndsAt: null,
                    createdAt: '2026-11-01T00:00:00.000Z',
                    paidAfterCancellation: null,
                    pause: null,
                    promo: null,
                    succession: null,
                    nextCharge: null,
                    plan: {
                        slug: 'test-plan',
                        name: 'Test plan',
                        amount: 1,
                        currency: 'ARS',
                        cycle: 'monthly'
                    }
                }
            ])
        );
        expect(await hasAnySubscription(input)).toBe(true);
        expect(await hasAnySubscription(input)).toBe(true);
        expect(listMine).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(60_001);
        listMine.mockRejectedValue(new Error('offline'));
        expect(await hasAnySubscription(input)).toBe(false);
    });

    it.each([
        { ok: false, error: { status: 503 } },
        { ok: true, data: { subscriptions: [{}] } },
        null
    ])('fails closed on unsuccessful or malformed reads: %j', async (result) => {
        const { hasAnySubscription } = await import('@/lib/account-has-subscription');
        listMine.mockResolvedValue(result);
        expect(await hasAnySubscription(input)).toBe(false);
    });

    it('never throws on network failure or missing credentials', async () => {
        const { hasAnySubscription } = await import('@/lib/account-has-subscription');
        listMine.mockRejectedValue(new Error('offline'));
        expect(await hasAnySubscription(input)).toBe(false);
        expect(await hasAnySubscription({ userId: 'guest' })).toBe(false);
    });
});
