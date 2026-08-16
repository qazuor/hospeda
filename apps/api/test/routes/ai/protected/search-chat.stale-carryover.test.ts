/**
 * Unit tests for search-chat.stale-carryover.ts (HOS-551 / H-71).
 *
 * Pure function, zero DB, zero AI calls, zero side effects. AAA
 * (Arrange / Act / Assert) pattern throughout.
 */

import { AccommodationTypeEnum, type SearchIntentEntities } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { dropStaleAmenitiesOnLocationChange } from '../../../../src/routes/ai/protected/search-chat.stale-carryover.js';

const COLON_UUID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CONCORDIA_UUID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

describe('dropStaleAmenitiesOnLocationChange — HOS-551 / H-71 production repro', () => {
    it('drops an unmentioned hasPool that survived identical when a new destinationId appears', () => {
        // Arrange — turn 1: cabaña para 4 con pileta. turn 2 (model output):
        // hotel en Colón para 2 — type and guests genuinely updated, but
        // hasPool: true is byte-identical carryover from turn 1.
        const previous: SearchIntentEntities = {
            accommodationType: AccommodationTypeEnum.CABIN,
            minGuests: 4,
            hasPool: true
        };
        const current: SearchIntentEntities = {
            accommodationType: AccommodationTypeEnum.HOTEL,
            minGuests: 2,
            destinationId: COLON_UUID,
            hasPool: true
        };

        // Act
        const result = dropStaleAmenitiesOnLocationChange(current, previous);

        // Assert
        expect(result.hasPool).toBeUndefined();
        expect('hasPool' in result).toBe(false);
        // The genuinely-updated fields are untouched.
        expect(result.accommodationType).toBe(AccommodationTypeEnum.HOTEL);
        expect(result.minGuests).toBe(2);
        expect(result.destinationId).toBe(COLON_UUID);
    });

    it('drops an unmentioned hasWifi/allowsPets/hasParking the same way', () => {
        // Arrange
        const previous: SearchIntentEntities = {
            city: 'Colón',
            hasWifi: true,
            allowsPets: true,
            hasParking: true
        };
        const current: SearchIntentEntities = {
            destinationId: CONCORDIA_UUID,
            hasWifi: true,
            allowsPets: true,
            hasParking: true
        };

        // Act
        const result = dropStaleAmenitiesOnLocationChange(current, previous);

        // Assert
        expect(result.hasWifi).toBeUndefined();
        expect(result.allowsPets).toBeUndefined();
        expect(result.hasParking).toBeUndefined();
    });

    it('drops amenitySlugs / featureSlugs that are byte-identical carryover on a new destination', () => {
        // Arrange
        const previous: SearchIntentEntities = {
            city: 'Colón',
            amenitySlugs: ['bbq', 'pool'],
            featureSlugs: ['river_front']
        };
        const current: SearchIntentEntities = {
            destinationId: CONCORDIA_UUID,
            amenitySlugs: ['pool', 'bbq'], // same set, different order
            featureSlugs: ['river_front']
        };

        // Act
        const result = dropStaleAmenitiesOnLocationChange(current, previous);

        // Assert
        expect(result.amenitySlugs).toBeUndefined();
        expect(result.featureSlugs).toBeUndefined();
    });

    it('keeps hasPool when the destination is unchanged (genuine refinement)', () => {
        // Arrange — same destination both turns: this is the documented
        // "carry the rest of the search forward" refinement case.
        const previous: SearchIntentEntities = {
            destinationId: COLON_UUID,
            accommodationType: AccommodationTypeEnum.CABIN,
            hasPool: true
        };
        const current: SearchIntentEntities = {
            destinationId: COLON_UUID,
            accommodationType: AccommodationTypeEnum.CABIN,
            hasPool: true,
            maxPrice: 50000
        };

        // Act
        const result = dropStaleAmenitiesOnLocationChange(current, previous);

        // Assert
        expect(result.hasPool).toBe(true);
        expect(result.maxPrice).toBe(50000);
    });

    it('keeps hasPool when no destination is named this turn at all (documented "keep current" refinement)', () => {
        // Arrange — message names no location; per the prompt's own rule this
        // keeps the current destination, so it must never be treated as a
        // new-destination signal.
        const previous: SearchIntentEntities = {
            destinationId: COLON_UUID,
            hasPool: true
        };
        const current: SearchIntentEntities = {
            hasPool: true,
            minGuests: 6
        };

        // Act
        const result = dropStaleAmenitiesOnLocationChange(current, previous);

        // Assert
        expect(result.hasPool).toBe(true);
        expect(result.minGuests).toBe(6);
    });

    it('keeps a freshly re-extracted hasPool that differs from the prior value', () => {
        // Arrange — a genuine change (true → false, i.e. "sin pileta") must
        // never be treated as stale carryover, even alongside a new destination.
        const previous: SearchIntentEntities = {
            destinationId: COLON_UUID,
            hasPool: true
        };
        const current: SearchIntentEntities = {
            destinationId: CONCORDIA_UUID,
            hasPool: false
        };

        // Act
        const result = dropStaleAmenitiesOnLocationChange(current, previous);

        // Assert
        expect(result.hasPool).toBe(false);
    });

    it('is a no-op (same reference) on a first turn with no previous entities', () => {
        // Arrange
        const current: SearchIntentEntities = {
            destinationId: COLON_UUID,
            hasPool: true
        };

        // Act
        const result = dropStaleAmenitiesOnLocationChange(current, undefined);

        // Assert — nothing to compare against, so nothing to drop.
        expect(result).toBe(current);
    });

    it('treats a nil-UUID destinationId as no location signal (never a "new destination")', () => {
        // Arrange — the model's "there is a destination, I just do not know
        // which" placeholder must not be read as a genuine destination change.
        const previous: SearchIntentEntities = {
            city: 'Colón',
            hasPool: true
        };
        const current: SearchIntentEntities = {
            destinationId: '00000000-0000-0000-0000-000000000000',
            hasPool: true
        };

        // Act
        const result = dropStaleAmenitiesOnLocationChange(current, previous);

        // Assert
        expect(result.hasPool).toBe(true);
    });

    it('returns the same reference when a new destination appears but nothing is stale', () => {
        // Arrange — a new destination this turn, but every field is either new
        // or already different from the prior turn — nothing to drop.
        const previous: SearchIntentEntities = { city: 'Colón', minGuests: 4 };
        const current: SearchIntentEntities = {
            destinationId: CONCORDIA_UUID,
            minGuests: 2
        };

        // Act
        const result = dropStaleAmenitiesOnLocationChange(current, previous);

        // Assert
        expect(result).toBe(current);
    });
});
