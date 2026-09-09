/**
 * @file tourist-vip-already-held.test.ts
 * @description HOS-1233 D-4 / AC-16..AC-19 — who already holds the tourist-VIP
 * benefits, and the two states that must NOT count.
 *
 * The assertion that matters most here is a `false` (AC-17: a trialing visitor
 * keeps the button), and a `false` is the shape that passes for the wrong
 * reason most easily — a typo in the status string produces it too. Every
 * negative case below therefore has a positive sibling differing ONLY in the
 * status value, so a misspelt fixture fails the sibling instead of quietly
 * satisfying both.
 */

import { describe, expect, it } from 'vitest';

import {
    holdsTouristVipBenefits,
    TOURIST_VIP_BLOCKING_DOMAINS,
    VIP_BENEFIT_HOLDING_STATUSES
} from '@/lib/billing/tourist-vip-already-held';

/** Every status the protected subscription endpoint can send today. */
const KNOWN_WIRE_STATUSES = [
    'active',
    'trial',
    'cancelled',
    'expired',
    'past_due',
    'pending',
    'paused',
    'courtesy'
] as const;

describe('the blocking domains (D-4)', () => {
    it('is exactly accommodation, gastronomy and experience', () => {
        expect([...TOURIST_VIP_BLOCKING_DOMAINS]).toEqual([
            'accommodation',
            'gastronomy',
            'experience'
        ]);
    });

    it('excludes tourist and partner', () => {
        // Tourist goes through the ordinary plan-change path; partner does not
        // spread the tourist-VIP constants. Adding either here would disable
        // the button for someone who can legitimately buy.
        expect(TOURIST_VIP_BLOCKING_DOMAINS).not.toContain('tourist');
        expect(TOURIST_VIP_BLOCKING_DOMAINS).not.toContain('partner');
    });
});

describe('the holding allowlist', () => {
    it('is frozen at active, past_due and courtesy', () => {
        // Freezing the list is what forces a deliberate edit — and a look at
        // AC-17 — before a new status starts disabling the button. Note this
        // cannot catch a NEW status the API invents; it catches somebody
        // adding one to the allowlist without deciding.
        expect([...VIP_BENEFIT_HOLDING_STATUSES]).toEqual(['active', 'past_due', 'courtesy']);
    });

    it('does not contain trial — AC-17, and it is the one that gets "simplified"', () => {
        expect(VIP_BENEFIT_HOLDING_STATUSES).not.toContain('trial');
    });

    it('uses the WIRE spelling, not the domain enum spelling', () => {
        // The API maps `trialing` to `'trial'`. A predicate comparing
        // 'trialing' would never match and would read as "not on trial",
        // failing silently in the direction that costs a sale.
        expect(VIP_BENEFIT_HOLDING_STATUSES).not.toContain('trialing');
        expect(VIP_BENEFIT_HOLDING_STATUSES).not.toContain('comp');
    });
});

describe('holdsTouristVipBenefits — holds (AC-16)', () => {
    it.each([
        'accommodation',
        'gastronomy',
        'experience'
    ] as const)('an active subscription in %s holds the benefits', (domain) => {
        expect(
            holdsTouristVipBenefits({
                subscriptionsByDomain: { [domain]: { status: 'active' } }
            })
        ).toBe(true);
    });

    it('a past_due subscription still holds them during the dunning grace', () => {
        expect(
            holdsTouristVipBenefits({
                subscriptionsByDomain: { accommodation: { status: 'past_due' } }
            })
        ).toBe(true);
    });

    it('a courtesy window holds them', () => {
        expect(
            holdsTouristVipBenefits({
                subscriptionsByDomain: { gastronomy: { status: 'courtesy' } }
            })
        ).toBe(true);
    });

    it('a complimentary subscription holds them — it arrives as active', () => {
        // There is no 'comp' on the wire: the endpoint sends `status: 'active'`
        // with `isComplimentary: true`. This test exists so that stays true by
        // assertion rather than by memory.
        expect(
            holdsTouristVipBenefits({
                subscriptionsByDomain: { accommodation: { status: 'active' } }
            })
        ).toBe(true);
    });

    it('holds when only one of three verticals qualifies', () => {
        expect(
            holdsTouristVipBenefits({
                subscriptionsByDomain: {
                    accommodation: { status: 'cancelled' },
                    gastronomy: null,
                    experience: { status: 'active' }
                }
            })
        ).toBe(true);
    });
});

describe('holdsTouristVipBenefits — does NOT hold (AC-17 / AC-18 / R-7)', () => {
    it('a TRIALING visitor keeps the button — AC-17', () => {
        // The deliberate one. Someone mid-trial holds the entitlements today
        // but may not tomorrow; disabling them would leave no way to keep the
        // benefits if the trial lapses.
        expect(
            holdsTouristVipBenefits({
                subscriptionsByDomain: { accommodation: { status: 'trial' } }
            })
        ).toBe(false);
    });

    it('the SAME fixture with status active holds — the sibling that proves the above is not a typo', () => {
        expect(
            holdsTouristVipBenefits({
                subscriptionsByDomain: { accommodation: { status: 'active' } }
            })
        ).toBe(true);
    });

    it.each([
        'cancelled',
        'expired',
        'pending',
        'paused'
    ] as const)('a %s subscription does not hold them', (status) => {
        expect(
            holdsTouristVipBenefits({
                subscriptionsByDomain: { accommodation: { status } }
            })
        ).toBe(false);
    });

    it('a subscription OBJECT is not enough — AC-18 reads the status, not the presence', () => {
        // The failure R-7 names: claiming a benefit from the existence of a
        // subscription rather than from its being live.
        expect(
            holdsTouristVipBenefits({
                subscriptionsByDomain: {
                    accommodation: { status: 'expired' },
                    gastronomy: { status: 'cancelled' },
                    experience: { status: 'paused' }
                }
            })
        ).toBe(false);
    });

    it('no subscriptions at all does not hold them', () => {
        expect(
            holdsTouristVipBenefits({
                subscriptionsByDomain: {
                    accommodation: null,
                    gastronomy: null,
                    experience: null
                }
            })
        ).toBe(false);
    });

    it('an empty record does not hold them — an unread domain is never assumed', () => {
        expect(holdsTouristVipBenefits({ subscriptionsByDomain: {} })).toBe(false);
    });

    it('an UNKNOWN status does not hold them — the R-7 direction', () => {
        // A ninth status shipped by a later spec must leave the button
        // enabled, not disable it. A denylist would do the opposite.
        expect(
            holdsTouristVipBenefits({
                subscriptionsByDomain: { accommodation: { status: 'some_future_status' } }
            })
        ).toBe(false);
    });

    it('a tourist subscription is not read at all', () => {
        // Not in the blocking set: an active tourist subscription must not
        // make the predicate true, or the plan-change path would be blocked by
        // the thing it is trying to change.
        expect(
            holdsTouristVipBenefits({
                subscriptionsByDomain: {
                    // biome-ignore lint/suspicious/noExplicitAny: deliberately
                    // passing a domain outside the blocking set, which the type
                    // correctly rejects — that rejection is what is under test.
                    ...({ tourist: { status: 'active' } } as any)
                }
            })
        ).toBe(false);
    });
});

describe('every known wire status is classified', () => {
    it.each(KNOWN_WIRE_STATUSES)('classifies %s without falling through', (status) => {
        // Non-vacuity: proves the predicate returns a real boolean for each of
        // the eight, rather than only for the ones named individually above.
        const result = holdsTouristVipBenefits({
            subscriptionsByDomain: { accommodation: { status } }
        });

        expect(typeof result).toBe('boolean');
        expect(result).toBe(VIP_BENEFIT_HOLDING_STATUSES.includes(status));
    });
});
