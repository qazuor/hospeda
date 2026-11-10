/**
 * @file listing-policies.test.ts
 * @description Parsing and PATCH-diff rules for the `policies` JSONB (HOS-2060).
 */

import { describe, expect, it } from 'vitest';
import {
    buildListingPoliciesPatch,
    parseListingPolicyValues,
    setListingPolicy
} from '../../../src/lib/listing/listing-policies';

describe('parseListingPolicyValues', () => {
    it('returns {} for a non-object payload', () => {
        // Arrange / Act / Assert
        expect(parseListingPolicyValues({ raw: null })).toEqual({});
        expect(parseListingPolicyValues({ raw: 'x' })).toEqual({});
    });

    it('keeps valid keys and drops malformed ones individually', () => {
        // Arrange
        const raw = {
            paymentMethods: ['credit', 'cash', 'bitcoin'],
            pets: { admission: 'on_request', extraCost: true },
            smokingAllowed: 'maybe',
            eventsAllowed: false,
            checkIn: { from: '14:00', to: '25:00' },
            minNights: 2,
            maxNights: -1,
            minAge: 18,
            dressCode: 'elegant',
            dressCodeNote: { es: '', en: '', pt: '' }
        };

        // Act
        const result = parseListingPolicyValues({ raw });

        // Assert
        expect(result).toEqual({
            paymentMethods: ['cash', 'credit'],
            pets: { admission: 'on_request', extraCost: true },
            eventsAllowed: false,
            checkIn: { from: '14:00' },
            minNights: 2,
            minAge: 18,
            dressCode: 'elegant'
        });
    });

    it('treats an empty payment list and a blank cancellation as absent', () => {
        // Arrange / Act
        const result = parseListingPolicyValues({
            raw: { paymentMethods: [], cancellation: '   ' }
        });

        // Assert
        expect(result).toEqual({});
    });
});

describe('buildListingPoliciesPatch', () => {
    it('returns null when no owned key changed', () => {
        // Arrange
        const policies = { minAge: 18, paymentMethods: ['cash'] as const };

        // Act / Assert
        expect(
            buildListingPoliciesPatch({ current: policies, baseline: policies, keys: ['minAge'] })
        ).toBeNull();
    });

    it('sends only changed owned keys, null for a removed key', () => {
        // Arrange
        const baseline = { minAge: 18, smokingAllowed: 'no' as const, eventsAllowed: true };
        const current = { minAge: 21, eventsAllowed: true, paymentMethods: ['cash' as const] };

        // Act
        const patch = buildListingPoliciesPatch({
            current,
            baseline,
            keys: ['smokingAllowed', 'eventsAllowed', 'paymentMethods']
        });

        // Assert — minAge changed but is not owned, so it never ships.
        expect(patch).toEqual({ smokingAllowed: null, paymentMethods: ['cash'] });
    });
});

describe('setListingPolicy', () => {
    it('sets and removes a key without mutating the input', () => {
        // Arrange
        const policies = { minAge: 18 };

        // Act
        const added = setListingPolicy({ policies, key: 'eventsAllowed', value: true });
        const removed = setListingPolicy({ policies: added, key: 'minAge', value: undefined });

        // Assert
        expect(policies).toEqual({ minAge: 18 });
        expect(added).toEqual({ minAge: 18, eventsAllowed: true });
        expect(removed).toEqual({ eventsAllowed: true });
    });
});
