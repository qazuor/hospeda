/**
 * @file subscription-domain.test.ts
 * @description Unit tests for the four-way `/mi-cuenta/suscripcion/` domain
 * resolution helpers (HOS-689 item 3, widened to `tourist` by HOS-1321).
 */

import { describe, expect, it } from 'vitest';
import {
    CHANGE_PLAN_RESOLVABLE_STATUSES,
    isSubscriptionDashboardDomain,
    planChangeWouldResolveAnotherSubscription,
    resolveActiveSubscriptionDomain,
    resolveDashboardPlanSource,
    SUBSCRIPTION_DASHBOARD_DOMAINS
} from '../../../src/lib/billing/subscription-domain';

// ---------------------------------------------------------------------------
// SUBSCRIPTION_DASHBOARD_DOMAINS
// ---------------------------------------------------------------------------

describe('SUBSCRIPTION_DASHBOARD_DOMAINS', () => {
    it('is exactly the four domains, tourist LAST (HOS-689 AC-21 / HOS-1321)', () => {
        // HOS-688 retired the binary 'accommodation' | 'commerce' union — the
        // dashboard must resolve all real subscription domains, never the
        // transitional 'commerce' umbrella. HOS-1321 added 'tourist' as the
        // fourth, and its POSITION is asserted, not just its presence: the
        // resolver below lands an unqualified visitor on heldDomains[0].
        expect(SUBSCRIPTION_DASHBOARD_DOMAINS).toEqual([
            'accommodation',
            'gastronomy',
            'experience',
            'tourist'
        ]);
    });
});

// ---------------------------------------------------------------------------
// isSubscriptionDashboardDomain
// ---------------------------------------------------------------------------

describe('isSubscriptionDashboardDomain', () => {
    it('accepts every valid domain', () => {
        expect(isSubscriptionDashboardDomain('accommodation')).toBe(true);
        expect(isSubscriptionDashboardDomain('gastronomy')).toBe(true);
        expect(isSubscriptionDashboardDomain('experience')).toBe(true);
        expect(isSubscriptionDashboardDomain('tourist')).toBe(true);
    });

    it('rejects the retired "commerce" umbrella value', () => {
        expect(isSubscriptionDashboardDomain('commerce')).toBe(false);
    });

    it('rejects null', () => {
        expect(isSubscriptionDashboardDomain(null)).toBe(false);
    });

    it('rejects an arbitrary/garbage string', () => {
        expect(isSubscriptionDashboardDomain('not-a-domain')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// resolveActiveSubscriptionDomain
// ---------------------------------------------------------------------------

describe('resolveActiveSubscriptionDomain', () => {
    it('honors an explicit, valid ?domain= over held domains', () => {
        // Arrange & Act — the SUSPENDED-listing recover CTA links directly at
        // a domain that may not even be held (a lapsed subscription).
        const result = resolveActiveSubscriptionDomain({
            rawDomain: 'experience',
            heldDomains: ['accommodation']
        });

        // Assert
        expect(result).toBe('experience');
    });

    it('falls back to the first held domain when ?domain= is absent', () => {
        // Arrange & Act — a commerce-only owner (no accommodation
        // subscription at all) must land on THEIR subscription, not an
        // accommodation "no subscription" empty state (HOS-689 AC-21).
        const result = resolveActiveSubscriptionDomain({
            rawDomain: null,
            heldDomains: ['gastronomy', 'experience']
        });

        // Assert
        expect(result).toBe('gastronomy');
    });

    it('falls back to the first held domain when ?domain= is invalid', () => {
        // Arrange & Act
        const result = resolveActiveSubscriptionDomain({
            rawDomain: 'commerce',
            heldDomains: ['experience']
        });

        // Assert
        expect(result).toBe('experience');
    });

    it('defaults to accommodation when nothing is held and no ?domain= is given', () => {
        // Arrange & Act — matches every pre-HOS-689 caller's behaviour.
        const result = resolveActiveSubscriptionDomain({ rawDomain: null, heldDomains: [] });

        // Assert
        expect(result).toBe('accommodation');
    });

    // -- HOS-1321: the tourist audience ------------------------------------

    it('HOS-1321: a tourist-only holder lands on their OWN subscription, not an accommodation empty state', () => {
        // Arrange & Act — the whole bug: before tourist was a selectable
        // domain this resolved 'accommodation' and rendered "Sin suscripción
        // activa" to a paying `tourist-vip` holder.
        const result = resolveActiveSubscriptionDomain({
            rawDomain: null,
            heldDomains: ['tourist']
        });

        // Assert
        expect(result).toBe('tourist');
    });

    it('HOS-1321: ?domain=tourist is honored explicitly (the switcher link)', () => {
        // Arrange & Act
        const result = resolveActiveSubscriptionDomain({
            rawDomain: 'tourist',
            heldDomains: ['accommodation', 'tourist']
        });

        // Assert
        expect(result).toBe('tourist');
    });

    it('HOS-1321: the DUAL host+tourist holder defaults to accommodation, never tourist', () => {
        // Arrange — host-onboarding auto-promotes a traveller to HOST without
        // touching their tourist subscription, so one account legitimately
        // holds both. HOS-1233 made the API's tourist resolution an ORDERED
        // fallback for exactly this; the dashboard must not disagree with it.
        // Fed in the order the page derives them (SUBSCRIPTION_DASHBOARD_DOMAINS).
        const result = resolveActiveSubscriptionDomain({
            rawDomain: null,
            heldDomains: ['accommodation', 'tourist']
        });

        // Assert
        expect(result).toBe('accommodation');
    });

    it('HOS-1321: a commerce owner who is ALSO a tourist defaults to their commerce vertical', () => {
        // Arrange & Act — tourist is last in the priority order, so it only
        // ever wins when nothing else is held.
        const result = resolveActiveSubscriptionDomain({
            rawDomain: null,
            heldDomains: ['gastronomy', 'tourist']
        });

        // Assert
        expect(result).toBe('gastronomy');
    });
});

// ---------------------------------------------------------------------------
// resolveDashboardPlanSource
// ---------------------------------------------------------------------------

describe('resolveDashboardPlanSource', () => {
    it('accommodation sends NO domain and defers the category to roles', () => {
        // Arrange & Act
        const result = resolveDashboardPlanSource({ domain: 'accommodation' });

        // Assert — `undefined` is "send no ?domain=", which the endpoint
        // answers with its accommodation default; `null` is "decide by roles"
        // (BETA-173). Both unchanged.
        expect(result).toEqual({
            flow: 'accommodation',
            planDomain: undefined,
            category: null
        });
    });

    it('HOS-1321: tourist fetches ?domain=tourist, pinned to the tourist category', () => {
        // Arrange & Act — THE blocker. Since HOS-1233 the tourist tiers carry
        // `product_domain = 'tourist'` (`plans.config.ts`, the seed, and
        // data-migration 0103), and `listPlans.ts` excludes every out-of-domain
        // plan from a no-domain fetch. A tourist tab that sent no domain got a
        // catalogue with no tourist tiers in it, `filterPlansByCategory` yielded
        // `[]`, and the "Cambiar plan" button was never rendered for anybody.
        const result = resolveDashboardPlanSource({ domain: 'tourist' });

        // Assert
        expect(result).toEqual({
            flow: 'accommodation',
            planDomain: 'tourist',
            category: 'tourist'
        });
    });

    it('HOS-1321: tourist uses the accommodation plan-change flow, not the commerce one', () => {
        // Arrange & Act — the other half: `productDomain !== 'accommodation'`
        // would have posted a tourist plan change to
        // `/protected/commerce/tourist/change-plan`.
        const result = resolveDashboardPlanSource({ domain: 'tourist' });

        // Assert
        expect(result.flow).toBe('accommodation');
    });

    it.each([
        'gastronomy',
        'experience'
    ] as const)('%s fetches its own vertical through the commerce flow', (domain) => {
        // Arrange & Act
        const result = resolveDashboardPlanSource({ domain });

        // Assert
        expect(result).toEqual({ flow: 'commerce', planDomain: domain, category: 'owner' });
    });

    it('accommodation is the ONLY tab that sends no ?domain=', () => {
        // Arrange & Act & Assert — the property the blocker violated, stated
        // once over the whole mapping so a fifth domain cannot inherit the
        // accommodation default by omission.
        for (const domain of SUBSCRIPTION_DASHBOARD_DOMAINS) {
            const { planDomain } = resolveDashboardPlanSource({ domain });
            if (domain === 'accommodation') {
                expect(planDomain).toBeUndefined();
            } else {
                expect(planDomain).toBe(domain);
            }
        }
    });

    it('answers for every dashboard domain', () => {
        // Arrange & Act & Assert — a fifth domain added to the list without a
        // decision here fails this before it reaches a user.
        for (const domain of SUBSCRIPTION_DASHBOARD_DOMAINS) {
            expect(resolveDashboardPlanSource({ domain })).toBeDefined();
        }
    });
});

// ---------------------------------------------------------------------------
// planChangeWouldResolveAnotherSubscription
// ---------------------------------------------------------------------------

describe('planChangeWouldResolveAnotherSubscription', () => {
    it('HOS-1321: the DUAL host+tourist holder gets no plan change on their tourist tab', () => {
        // Arrange & Act — `POST /billing/subscriptions/change-plan` takes no
        // domain and resolves accommodation FIRST, so this tab's tourist tiers
        // would be applied to the OWNER subscription: a paid host plan silently
        // downgraded onto a tourist tier, with no error anywhere.
        const result = planChangeWouldResolveAnotherSubscription({
            domain: 'tourist',
            accommodationSubscription: 'held'
        });

        // Assert
        expect(result).toBe(true);
    });

    it('HOS-1321: an UNRESOLVED accommodation read withholds too — the guard fails CLOSED', () => {
        // Arrange & Act — the read is one of four parallel SSR fetches and the
        // client times out at 10s. Treating a failed read as "they have none"
        // re-opens the bug through the failure mode of its own input: one 500
        // and the dual holder lands here with a live plan change aimed at their
        // owner row.
        const result = planChangeWouldResolveAnotherSubscription({
            domain: 'tourist',
            accommodationSubscription: 'unknown'
        });

        // Assert
        expect(result).toBe(true);
    });

    it('HOS-1321: a tourist-ONLY holder keeps their plan change', () => {
        // Arrange & Act — with no accommodation subscription the route's
        // ordered pair falls through to the tourist one, which is the row this
        // tab is showing. Withholding here would strand the audience the tab
        // was built for.
        const result = planChangeWouldResolveAnotherSubscription({
            domain: 'tourist',
            accommodationSubscription: 'absent'
        });

        // Assert
        expect(result).toBe(false);
    });

    it.each([
        'accommodation',
        'gastronomy',
        'experience'
    ] as const)('never withholds the plan change on the %s tab, whatever the accommodation read said', (domain) => {
        // Arrange & Act — every other tab either IS the row the route
        // resolves, or has its own per-vertical change route.
        for (const reading of ['held', 'absent', 'unknown'] as const) {
            // Assert
            expect(
                planChangeWouldResolveAnotherSubscription({
                    domain,
                    accommodationSubscription: reading
                })
            ).toBe(false);
        }
    });
});

// ---------------------------------------------------------------------------
// CHANGE_PLAN_RESOLVABLE_STATUSES
// ---------------------------------------------------------------------------

describe('CHANGE_PLAN_RESOLVABLE_STATUSES', () => {
    it('is exactly the statuses change-plan selects on', () => {
        // Arrange & Act & Assert — `plan-change.ts` filters
        // `sub.status === 'active' || sub.status === 'trialing'` before calling
        // `selectAccommodationSubscription`, and this endpoint reports
        // `trialing` as `'trial'`. Anything wider withholds the tourist tab's
        // plan change for an accommodation subscription that route would never
        // have resolved.
        expect(CHANGE_PLAN_RESOLVABLE_STATUSES).toEqual(['active', 'trial']);
    });

    it.each([
        'paused',
        'past_due',
        'comp',
        'courtesy',
        'cancelled',
        'expired',
        'pending'
    ])('does not include %s — change-plan cannot resolve it', (status) => {
        // Arrange & Act & Assert
        expect(CHANGE_PLAN_RESOLVABLE_STATUSES).not.toContain(status);
    });
});
