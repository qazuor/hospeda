import { describe, expect, it } from 'vitest';
import {
    ENTITLEMENT_GRANTING_STATUSES,
    isEntitlementGrantingStatus
} from '../src/predicates/is-entitlement-granting-status.js';

describe('isEntitlementGrantingStatus', () => {
    it('returns true for the three entitlement-granting statuses', () => {
        expect(isEntitlementGrantingStatus('active')).toBe(true);
        expect(isEntitlementGrantingStatus('trialing')).toBe(true);
        // HOS-238 / HOS-239: comp is entitlement-granting (SPEC-262).
        expect(isEntitlementGrantingStatus('comp')).toBe(true);
    });

    it('returns false for non-granting / dead statuses', () => {
        for (const status of [
            'cancelled',
            'past_due',
            'paused',
            'expired',
            'unpaid',
            'incomplete'
        ]) {
            expect(isEntitlementGrantingStatus(status)).toBe(false);
        }
    });

    it('returns false for unknown / empty status strings (fail-closed)', () => {
        expect(isEntitlementGrantingStatus('')).toBe(false);
        expect(isEntitlementGrantingStatus('ACTIVE')).toBe(false);
        expect(isEntitlementGrantingStatus('whatever')).toBe(false);
    });

    it('exposes the canonical status set and it matches the predicate', () => {
        expect([...ENTITLEMENT_GRANTING_STATUSES]).toEqual([
            'active',
            'trialing',
            'comp',
            'courtesy'
        ]);
        for (const status of ENTITLEMENT_GRANTING_STATUSES) {
            expect(isEntitlementGrantingStatus(status)).toBe(true);
        }
    });

    it('grants entitlements during a courtesy window (HOS-180)', () => {
        expect(isEntitlementGrantingStatus('courtesy')).toBe(true);
    });

    it('still refuses paused — a real pause cuts access, a gift does not', () => {
        // The single most important pairing in this file. A courtesy sits on a
        // PAUSED MercadoPago preapproval, so if 'paused' ever joined the set the
        // two would become indistinguishable and every genuinely paused
        // subscriber would silently keep their entitlements.
        expect(isEntitlementGrantingStatus('paused')).toBe(false);
        expect(isEntitlementGrantingStatus('courtesy')).toBe(true);
    });
});
