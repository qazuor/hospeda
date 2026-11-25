import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listMine, listRecurringAddons } = vi.hoisted(() => ({
    listMine: vi.fn(),
    listRecurringAddons: vi.fn()
}));
vi.mock('@/lib/api/endpoints-protected', () => ({ billingSubscriptionApi: { listMine } }));
vi.mock('@/lib/api/endpoints-protected-addons', () => ({
    billingAddonApi: { listRecurringAddons }
}));

const input = { userId: 'owner-a', cookieHeader: 'test-session' };
const response = (subscriptions: unknown[]) => ({
    ok: true,
    data: { subscriptions, deferredCourtesies: [], declinedSignups: [], expiredDeclinedSignups: [] }
});
const activeAddon = {
    addonInstanceId: '123e4567-e89b-42d3-a456-426614174001',
    slug: 'destaque-alfa',
    name: 'Destaque Alfa',
    chargeKind: 'PERIODICO',
    cycle: 'monthly',
    price: 120000,
    currency: 'ARS',
    status: 'ACTIVE',
    targetId: null,
    targetName: null
};

describe('hasBillingPresence', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.resetAllMocks();
        vi.useFakeTimers();
        listMine.mockResolvedValue(response([]));
        listRecurringAddons.mockResolvedValue({ ok: true, data: { items: [] } });
    });
    afterEach(() => vi.useRealTimers());

    it('hides accounts with both lists empty, caches for 60 seconds and then retries', async () => {
        const { hasBillingPresence } = await import('@/lib/account-billing-presence');
        expect(await hasBillingPresence(input)).toBe(false);
        expect(await hasBillingPresence(input)).toBe(false);
        expect(listMine).toHaveBeenCalledTimes(1);
        expect(listRecurringAddons).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(60_001);
        await hasBillingPresence(input);
        expect(listMine).toHaveBeenCalledTimes(2);
        expect(listRecurringAddons).toHaveBeenCalledTimes(2);
        expect(listMine).toHaveBeenCalledWith({ cookieHeader: input.cookieHeader });
        expect(listRecurringAddons).toHaveBeenCalledWith({ cookieHeader: input.cookieHeader });
    });

    it('isolates users and coalesces concurrent reads of both lists', async () => {
        const { hasBillingPresence } = await import('@/lib/account-billing-presence');
        await Promise.all([hasBillingPresence(input), hasBillingPresence(input)]);
        await hasBillingPresence({ ...input, userId: 'owner-b' });
        expect(listMine).toHaveBeenCalledTimes(2);
        expect(listRecurringAddons).toHaveBeenCalledTimes(2);
    });

    it('shows and caches an active add-on even with zero subscriptions', async () => {
        const { hasBillingPresence } = await import('@/lib/account-billing-presence');
        listRecurringAddons.mockResolvedValue({ ok: true, data: { items: [activeAddon] } });
        expect(await hasBillingPresence(input)).toBe(true);
        expect(await hasBillingPresence(input)).toBe(true);
        expect(listRecurringAddons).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(60_001);
        listRecurringAddons.mockResolvedValue({ ok: true, data: { items: [] } });
        expect(await hasBillingPresence(input)).toBe(false);
    });

    it('does not count pending add-ons as active', async () => {
        const { hasBillingPresence } = await import('@/lib/account-billing-presence');
        listRecurringAddons.mockResolvedValue({
            ok: true,
            data: { items: [{ ...activeAddon, status: 'PENDING_AUTHORIZATION' }] }
        });
        expect(await hasBillingPresence(input)).toBe(false);
    });

    it('returns and caches true for a real subscription response, regardless of status', async () => {
        const { hasBillingPresence } = await import('@/lib/account-billing-presence');
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
        expect(await hasBillingPresence(input)).toBe(true);
        expect(await hasBillingPresence(input)).toBe(true);
        expect(listMine).toHaveBeenCalledTimes(1);
        expect(listRecurringAddons).not.toHaveBeenCalled();
        vi.advanceTimersByTime(60_001);
        listMine.mockRejectedValue(new Error('offline'));
        expect(await hasBillingPresence(input)).toBe(false);
    });

    it.each([
        { ok: false, error: { status: 503 } },
        { ok: true, data: { subscriptions: [{}] } },
        null
    ])('fails closed on unsuccessful or malformed subscription reads: %j', async (result) => {
        const { hasBillingPresence } = await import('@/lib/account-billing-presence');
        listMine.mockResolvedValue(result);
        expect(await hasBillingPresence(input)).toBe(false);
        expect(listRecurringAddons).not.toHaveBeenCalled();
    });

    it.each([
        { ok: false, error: { status: 503 } },
        { ok: true, data: { items: [{}] } },
        { ok: true, data: {} },
        null
    ])('fails closed on unsuccessful or malformed add-on reads: %j', async (result) => {
        const { hasBillingPresence } = await import('@/lib/account-billing-presence');
        listRecurringAddons.mockResolvedValue(result);
        expect(await hasBillingPresence(input)).toBe(false);
    });

    it('caches a failed add-on fetch as hidden and retries after expiration', async () => {
        const { hasBillingPresence } = await import('@/lib/account-billing-presence');
        listRecurringAddons.mockRejectedValue(new Error('offline'));
        expect(await hasBillingPresence(input)).toBe(false);
        listRecurringAddons.mockResolvedValue({ ok: true, data: { items: [activeAddon] } });
        expect(await hasBillingPresence(input)).toBe(false);
        vi.advanceTimersByTime(60_001);
        expect(await hasBillingPresence(input)).toBe(true);
    });

    it('never throws on subscription failure or missing credentials', async () => {
        const { hasBillingPresence } = await import('@/lib/account-billing-presence');
        expect(await hasBillingPresence({ userId: 'guest' })).toBe(false);
        expect(await hasBillingPresence({ ...input, userId: '' })).toBe(false);
        expect(listMine).not.toHaveBeenCalled();
        expect(listRecurringAddons).not.toHaveBeenCalled();
        listMine.mockRejectedValue(new Error('offline'));
        expect(await hasBillingPresence(input)).toBe(false);
    });
});
