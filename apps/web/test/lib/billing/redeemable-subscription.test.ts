/**
 * @file redeemable-subscription.test.ts
 * @description HOS-1293 — the multi-domain subscription resolution that
 * replaced an accommodation-only `userApi.getSubscription({ cookieHeader })`
 * call on both `/mi-cuenta/canjear/` routes.
 *
 * ## The bug this is a regression test for
 *
 * `GET /users/me/subscription` defaults to `productDomain: 'accommodation'`
 * server-side when the caller omits the param. Both redeem-page routes used
 * to call it with no `productDomain` at all, so a commerce-only owner (a
 * `GASTRONOMY_OWNER`/`EXPERIENCE_OWNER` with no accommodation subscription)
 * always resolved `subscription: null` — `subscriptionId` reached
 * `RedeemCodeSection` as `undefined`, and a DISCOUNT code could never be
 * applied for them, even though the promo-code effect engine has no
 * accommodation-only restriction. This suite pins the fix: every real
 * subscribable domain is tried, and the first one that actually holds a
 * subscription wins.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSubscription = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/endpoints-protected', () => ({
    userApi: { getSubscription }
}));

vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

import { resolveRedeemableSubscriptionId } from '@/lib/billing/redeemable-subscription';

/** A `getSubscription` result with no active subscription for that domain. */
const NONE = { ok: true as const, data: { subscription: null } };

/** A `getSubscription` result carrying a real subscription id. */
function held(id: string) {
    return { ok: true as const, data: { subscription: { id } } };
}

describe('resolveRedeemableSubscriptionId', () => {
    beforeEach(() => {
        getSubscription.mockReset();
    });

    it('queries every real subscribable domain — accommodation, gastronomy, experience, tourist', async () => {
        getSubscription.mockResolvedValue(NONE);

        await resolveRedeemableSubscriptionId({ cookieHeader: 'session=abc' });

        const queriedDomains = getSubscription.mock.calls.map(
            (call) => (call[0] as { productDomain: string }).productDomain
        );
        expect(queriedDomains).toEqual(['accommodation', 'gastronomy', 'experience', 'tourist']);
        // Never the retired 'commerce' value, and never omitted (which would
        // silently fall back to the server's accommodation default again).
        expect(queriedDomains).not.toContain('commerce');
        expect(queriedDomains).not.toContain(undefined);
    });

    it('HOS-1293 regression: a commerce-only owner with NO accommodation subscription resolves their gastronomy subscription', async () => {
        // The exact bug: accommodation resolves to nothing for this owner, but
        // they DO hold a gastronomy subscription.
        getSubscription.mockImplementation(({ productDomain }: { productDomain: string }) =>
            Promise.resolve(productDomain === 'gastronomy' ? held('sub-gastronomy-1') : NONE)
        );

        const result = await resolveRedeemableSubscriptionId({ cookieHeader: 'session=abc' });

        expect(result).toBe('sub-gastronomy-1');
    });

    it('an experience-only owner resolves their experience subscription', async () => {
        getSubscription.mockImplementation(({ productDomain }: { productDomain: string }) =>
            Promise.resolve(productDomain === 'experience' ? held('sub-experience-1') : NONE)
        );

        const result = await resolveRedeemableSubscriptionId({ cookieHeader: 'session=abc' });

        expect(result).toBe('sub-experience-1');
    });

    it('a paying tourist-vip subscriber resolves their tourist subscription', async () => {
        getSubscription.mockImplementation(({ productDomain }: { productDomain: string }) =>
            Promise.resolve(productDomain === 'tourist' ? held('sub-tourist-1') : NONE)
        );

        const result = await resolveRedeemableSubscriptionId({ cookieHeader: 'session=abc' });

        expect(result).toBe('sub-tourist-1');
    });

    it('preserves the pre-fix behaviour for a host: accommodation wins even if other domains also hold one', async () => {
        getSubscription.mockImplementation(({ productDomain }: { productDomain: string }) =>
            Promise.resolve(
                productDomain === 'accommodation'
                    ? held('sub-accommodation-1')
                    : held('sub-should-not-win')
            )
        );

        const result = await resolveRedeemableSubscriptionId({ cookieHeader: 'session=abc' });

        expect(result).toBe('sub-accommodation-1');
    });

    it('degrades to undefined when no domain holds a subscription', async () => {
        getSubscription.mockResolvedValue(NONE);

        const result = await resolveRedeemableSubscriptionId({ cookieHeader: 'session=abc' });

        expect(result).toBeUndefined();
    });

    it('degrades to undefined when every fetch fails (never throws)', async () => {
        getSubscription.mockResolvedValue({
            ok: false,
            error: { message: 'boom', status: 500 }
        });

        const result = await resolveRedeemableSubscriptionId({ cookieHeader: 'session=abc' });

        expect(result).toBeUndefined();
    });

    it('degrades to undefined when the underlying call throws', async () => {
        getSubscription.mockRejectedValue(new Error('network error'));

        const result = await resolveRedeemableSubscriptionId({ cookieHeader: 'session=abc' });

        expect(result).toBeUndefined();
    });
});
