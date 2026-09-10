/**
 * @file subscription-domain.test.ts
 * @description Unit tests for the four-way `/mi-cuenta/suscripcion/` domain
 * resolution helpers (HOS-689 item 3, widened to `tourist` by HOS-1321).
 */

import { describe, expect, it } from 'vitest';
import {
    isSubscriptionDashboardDomain,
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
    it('accommodation reads the accommodation catalogue and defers the category to roles', () => {
        // Arrange & Act
        const result = resolveDashboardPlanSource({ domain: 'accommodation' });

        // Assert — `null` is "decide by roles" (BETA-173), unchanged.
        expect(result).toEqual({ kind: 'accommodation', category: null });
    });

    it('HOS-1321: tourist reads the accommodation catalogue pinned to the tourist category', () => {
        // Arrange & Act — the owner's 2026-09-10 ruling: the "Cambiar plan" of
        // a tourist-vip holder offers tourist plans ONLY. Pinning the category
        // (rather than deferring to roles like accommodation does) is what
        // stops a host+tourist dual holder from being offered the owner
        // catalogue on their tourist tab.
        const result = resolveDashboardPlanSource({ domain: 'tourist' });

        // Assert
        expect(result).toEqual({ kind: 'accommodation', category: 'tourist' });
    });

    it('HOS-1321: tourist is NOT a commerce vertical', () => {
        // Arrange & Act — the regression this guards: the page used to decide
        // with `domain !== 'accommodation'`, which classifies tourist as
        // commerce, fetches a `?domain=tourist` catalogue that does not exist
        // and posts to `/protected/commerce/tourist/change-plan`.
        const result = resolveDashboardPlanSource({ domain: 'tourist' });

        // Assert
        expect(result.kind).not.toBe('commerce');
    });

    it.each([
        'gastronomy',
        'experience'
    ] as const)('%s reads its own vertical catalogue through the commerce flow', (domain) => {
        // Arrange & Act
        const result = resolveDashboardPlanSource({ domain });

        // Assert
        expect(result).toEqual({ kind: 'commerce', domain });
    });

    it('answers for every dashboard domain', () => {
        // Arrange & Act & Assert — a fifth domain added to the list without a
        // decision here fails this before it reaches a user.
        for (const domain of SUBSCRIPTION_DASHBOARD_DOMAINS) {
            expect(resolveDashboardPlanSource({ domain })).toBeDefined();
        }
    });
});
