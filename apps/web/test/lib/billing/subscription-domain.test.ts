/**
 * @file subscription-domain.test.ts
 * @description Unit tests for the three-way `/mi-cuenta/suscripcion/` domain
 * resolution helpers (HOS-689 item 3).
 */

import { describe, expect, it } from 'vitest';
import {
    isSubscriptionDashboardDomain,
    resolveActiveSubscriptionDomain,
    SUBSCRIPTION_DASHBOARD_DOMAINS
} from '../../../src/lib/billing/subscription-domain';

// ---------------------------------------------------------------------------
// SUBSCRIPTION_DASHBOARD_DOMAINS
// ---------------------------------------------------------------------------

describe('SUBSCRIPTION_DASHBOARD_DOMAINS', () => {
    it('is exactly the three domains — accommodation, gastronomy, experience (HOS-689 AC-21)', () => {
        // HOS-688 retired the binary 'accommodation' | 'commerce' union — the
        // dashboard must resolve all three real subscription domains, never
        // the transitional 'commerce' umbrella.
        expect(SUBSCRIPTION_DASHBOARD_DOMAINS).toEqual([
            'accommodation',
            'gastronomy',
            'experience'
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
});
