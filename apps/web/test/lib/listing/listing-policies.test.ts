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
    it('reads a valid minimum-age scope and drops a malformed one (HOS-2098)', () => {
        // Arrange / Act / Assert
        expect(
            parseListingPolicyValues({
                raw: { minAge: 18, minAgeScope: { kind: 'from_time', from: '00:00' } }
            })
        ).toEqual({ minAge: 18, minAgeScope: { kind: 'from_time', from: '00:00' } });
        expect(
            parseListingPolicyValues({
                raw: { minAge: 18, minAgeScope: { kind: 'from_time', from: '25:00' } }
            })
        ).toEqual({ minAge: 18 });
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

describe('deposit, spoken languages and events details (HOS-2120, HOS-2122)', () => {
    const NOTE = { es: 'Por transferencia', en: '', pt: '' };

    it('reads the new keys', () => {
        // Act
        const values = parseListingPolicyValues({
            raw: {
                deposit: { required: true, percentage: 30, notes: NOTE },
                spokenLanguages: ['en', 'es', 'other'],
                eventsAllowed: true,
                eventsDetails: {
                    maxGuests: 25,
                    amplifiedSound: false,
                    endTime: '23:30',
                    extraCost: true,
                    notes: NOTE
                }
            }
        });

        // Assert
        expect(values).toEqual({
            deposit: { required: true, percentage: 30, notes: NOTE },
            // Canonical order of the closed list, like payment methods.
            spokenLanguages: ['es', 'en', 'other'],
            eventsAllowed: true,
            eventsDetails: {
                maxGuests: 25,
                amplifiedSound: false,
                endTime: '23:30',
                extraCost: true,
                notes: NOTE
            }
        });
    });

    it('drops malformed parts and keeps the rest', () => {
        // Act
        const values = parseListingPolicyValues({
            raw: {
                deposit: { required: true, percentage: 250 },
                spokenLanguages: ['jp'],
                eventsAllowed: true,
                eventsDetails: { maxGuests: -1, endTime: 'tarde', amplifiedSound: true }
            }
        });

        // Assert
        expect(values).toEqual({
            deposit: { required: true },
            eventsAllowed: true,
            eventsDetails: { amplifiedSound: true }
        });
    });

    it('drops a deposit without its yes/no and a percentage on a "no"', () => {
        expect(parseListingPolicyValues({ raw: { deposit: { percentage: 20 } } })).toEqual({});
        expect(
            parseListingPolicyValues({ raw: { deposit: { required: false, percentage: 20 } } })
        ).toEqual({ deposit: { required: false } });
    });

    it.each([
        ['events not allowed', false],
        ['events not informed', undefined]
    ])('never reads event details when %s', (_label, eventsAllowed) => {
        // Act
        const values = parseListingPolicyValues({
            raw: { eventsAllowed, eventsDetails: { maxGuests: 10 } }
        });

        // Assert
        expect(values).not.toHaveProperty('eventsDetails');
    });

    it.each([
        ['false', false],
        ['not informed', undefined]
    ])('setting eventsAllowed to %s also removes the details', (_label, value) => {
        // Arrange
        const policies = { eventsAllowed: true, eventsDetails: { maxGuests: 10 } };

        // Act
        const next = setListingPolicy({ policies, key: 'eventsAllowed', value });

        // Assert
        expect(next).not.toHaveProperty('eventsDetails');
        expect(policies.eventsDetails).toEqual({ maxGuests: 10 });
    });

    it('keeps the details while eventsAllowed stays true', () => {
        const next = setListingPolicy({
            policies: { eventsAllowed: true, eventsDetails: { maxGuests: 10 } },
            key: 'eventsAllowed',
            value: true
        });
        expect(next.eventsDetails).toEqual({ maxGuests: 10 });
    });

    it('sends eventsDetails: null in the same PATCH when events switch to no', () => {
        // Arrange
        const baseline = { eventsAllowed: true, eventsDetails: { maxGuests: 10 } };
        const current = setListingPolicy({
            policies: baseline,
            key: 'eventsAllowed',
            value: false
        });

        // Act
        const patch = buildListingPoliciesPatch({
            current,
            baseline,
            keys: ['eventsAllowed', 'eventsDetails']
        });

        // Assert
        expect(patch).toEqual({ eventsAllowed: false, eventsDetails: null });
    });

    it('sends null for a cleared deposit and spoken languages', () => {
        const patch = buildListingPoliciesPatch({
            current: {},
            baseline: { deposit: { required: true }, spokenLanguages: ['es'] },
            keys: ['deposit', 'spokenLanguages']
        });
        expect(patch).toEqual({ deposit: null, spokenLanguages: null });
    });
});

describe('HOS-910: clearing the minimum stay', () => {
    it('sends minNights: null when the host empties it', () => {
        const patch = buildListingPoliciesPatch({
            current: { paymentMethods: ['cash'] },
            baseline: { paymentMethods: ['cash'], minNights: 3 },
            keys: ['minNights', 'maxNights']
        });
        expect(patch).toEqual({ minNights: null });
    });
});
