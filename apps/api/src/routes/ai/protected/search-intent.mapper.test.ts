/**
 * Unit tests for search-intent.mapper.ts (SPEC-199 T-002).
 *
 * Covers 100% of `mapIntentToSearchParams` branches per §8.1 and §8.5 of
 * SPEC-199.  All tests are pure — zero DB, zero AI calls, zero side effects.
 *
 * AAA (Arrange / Act / Assert) pattern is used throughout.
 */

import { AccommodationTypeEnum, PriceCurrencyEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { mapIntentToSearchParams } from './search-intent.mapper.js';

// ─── Location priority ────────────────────────────────────────────────────────

describe('mapIntentToSearchParams — location priority', () => {
    it('AC-13: destinationId wins over city and geo when all three present', () => {
        // Arrange
        const entities = {
            destinationId: 'a0000000-0000-4000-8000-000000000001',
            city: 'Buenos Aires',
            latitude: -34.6037,
            longitude: -58.3816,
            radius: 10
        };

        // Act
        const result = mapIntentToSearchParams(entities);

        // Assert
        expect(result.destinationId).toBe('a0000000-0000-4000-8000-000000000001');
        expect(result.q).toBeUndefined();
        expect(result.latitude).toBeUndefined();
        expect(result.longitude).toBeUndefined();
        expect(result.radius).toBeUndefined();
    });

    it('destinationId wins over city alone', () => {
        const entities = {
            destinationId: 'a0000000-0000-4000-8000-000000000002',
            city: 'Córdoba'
        };
        const result = mapIntentToSearchParams(entities);
        expect(result.destinationId).toBe('a0000000-0000-4000-8000-000000000002');
        expect(result.q).toBeUndefined();
    });

    it('destinationId wins over geo coords alone', () => {
        const entities = {
            destinationId: 'a0000000-0000-4000-8000-000000000003',
            latitude: -31.4,
            longitude: -64.2
        };
        const result = mapIntentToSearchParams(entities);
        expect(result.destinationId).toBe('a0000000-0000-4000-8000-000000000003');
        expect(result.latitude).toBeUndefined();
    });

    it('geo coords used when no destinationId but both lat + lng present', () => {
        const entities = {
            latitude: -32.12,
            longitude: -58.45,
            radius: 50
        };
        const result = mapIntentToSearchParams(entities);
        expect(result.latitude).toBe('-32.12');
        expect(result.longitude).toBe('-58.45');
        expect(result.radius).toBe('50');
        expect(result.destinationId).toBeUndefined();
        expect(result.q).toBeUndefined();
    });

    it('geo used over city when both present and no destinationId', () => {
        const entities = {
            city: 'Rosario',
            latitude: -32.9442,
            longitude: -60.6505
        };
        const result = mapIntentToSearchParams(entities);
        expect(result.latitude).toBe('-32.9442');
        expect(result.longitude).toBe('-60.6505');
        expect(result.q).toBeUndefined();
    });

    it('city emitted as q when only city present', () => {
        const entities = { city: 'Concepción del Uruguay' };
        const result = mapIntentToSearchParams(entities);
        expect(result.q).toBe('Concepción del Uruguay');
        expect(result.destinationId).toBeUndefined();
        expect(result.latitude).toBeUndefined();
    });

    it('no location param emitted when no location field set', () => {
        const result = mapIntentToSearchParams({});
        expect(result.destinationId).toBeUndefined();
        expect(result.latitude).toBeUndefined();
        expect(result.longitude).toBeUndefined();
        expect(result.q).toBeUndefined();
    });

    it('longitude alone does NOT emit geo (needs both lat + lng)', () => {
        const entities = { longitude: -58.38 };
        const result = mapIntentToSearchParams(entities);
        expect(result.longitude).toBeUndefined();
        expect(result.latitude).toBeUndefined();
    });

    it('latitude alone does NOT emit geo (needs both lat + lng)', () => {
        const entities = { latitude: -34.6 };
        const result = mapIntentToSearchParams(entities);
        expect(result.latitude).toBeUndefined();
        expect(result.longitude).toBeUndefined();
    });
});

// ─── Radius clamping ─────────────────────────────────────────────────────────

describe('mapIntentToSearchParams — radius clamping', () => {
    it('radius passed through unchanged when <= 500', () => {
        const result = mapIntentToSearchParams({ latitude: -32, longitude: -58, radius: 300 });
        expect(result.radius).toBe('300');
    });

    it('radius clamped to 500 when > 500 (AC-16)', () => {
        const result = mapIntentToSearchParams({ latitude: -32, longitude: -58, radius: 999 });
        expect(result.radius).toBe('500');
    });

    it('radius at exactly 500 is not clamped', () => {
        const result = mapIntentToSearchParams({ latitude: -32, longitude: -58, radius: 500 });
        expect(result.radius).toBe('500');
    });

    it('radius omitted when lat + lng not both present', () => {
        const result = mapIntentToSearchParams({ latitude: -32, radius: 100 });
        expect(result.radius).toBeUndefined();
    });
});

// ─── Accommodation type ───────────────────────────────────────────────────────

describe('mapIntentToSearchParams — accommodation type', () => {
    // Use Object.values(AccommodationTypeEnum).length instead of hard-coding 10 (§8.4)
    it(`maps all ${Object.values(AccommodationTypeEnum).length} accommodation types to type param`, () => {
        for (const typeValue of Object.values(AccommodationTypeEnum)) {
            const result = mapIntentToSearchParams({ accommodationType: typeValue });
            expect(result.type).toBe(typeValue);
        }
    });

    it('AC-2: accommodationType CABIN → type CABIN', () => {
        const result = mapIntentToSearchParams({ accommodationType: AccommodationTypeEnum.CABIN });
        expect(result.type).toBe('CABIN');
    });

    it('type omitted when accommodationType not set', () => {
        const result = mapIntentToSearchParams({});
        expect(result.type).toBeUndefined();
    });
});

// ─── Guest capacity ───────────────────────────────────────────────────────────

describe('mapIntentToSearchParams — guest capacity', () => {
    it('AC-2: minGuests 4 → minGuests "4"', () => {
        const result = mapIntentToSearchParams({ minGuests: 4 });
        expect(result.minGuests).toBe('4');
    });

    it('both minGuests and maxGuests set when valid range', () => {
        const result = mapIntentToSearchParams({ minGuests: 2, maxGuests: 6 });
        expect(result.minGuests).toBe('2');
        expect(result.maxGuests).toBe('6');
    });

    it('conflict: minGuests > maxGuests → drops maxGuests (§5.3)', () => {
        const result = mapIntentToSearchParams({ minGuests: 5, maxGuests: 2 });
        expect(result.minGuests).toBe('5');
        expect(result.maxGuests).toBeUndefined();
    });

    it('equal minGuests == maxGuests → both emitted', () => {
        const result = mapIntentToSearchParams({ minGuests: 4, maxGuests: 4 });
        expect(result.minGuests).toBe('4');
        expect(result.maxGuests).toBe('4');
    });

    it('only maxGuests set → emitted correctly', () => {
        const result = mapIntentToSearchParams({ maxGuests: 8 });
        expect(result.maxGuests).toBe('8');
        expect(result.minGuests).toBeUndefined();
    });
});

// ─── Bedroom count ────────────────────────────────────────────────────────────

describe('mapIntentToSearchParams — bedroom count', () => {
    it('both minBedrooms and maxBedrooms in valid range → both emitted', () => {
        const result = mapIntentToSearchParams({ minBedrooms: 1, maxBedrooms: 3 });
        expect(result.minBedrooms).toBe('1');
        expect(result.maxBedrooms).toBe('3');
    });

    it('conflict: minBedrooms > maxBedrooms → drops maxBedrooms (§5.3 expanded row)', () => {
        const result = mapIntentToSearchParams({ minBedrooms: 4, maxBedrooms: 2 });
        expect(result.minBedrooms).toBe('4');
        expect(result.maxBedrooms).toBeUndefined();
    });

    it('equal minBedrooms == maxBedrooms → both emitted', () => {
        const result = mapIntentToSearchParams({ minBedrooms: 2, maxBedrooms: 2 });
        expect(result.minBedrooms).toBe('2');
        expect(result.maxBedrooms).toBe('2');
    });

    it('only minBedrooms set → emitted without maxBedrooms', () => {
        const result = mapIntentToSearchParams({ minBedrooms: 2 });
        expect(result.minBedrooms).toBe('2');
        expect(result.maxBedrooms).toBeUndefined();
    });

    it('only maxBedrooms set → emitted without minBedrooms', () => {
        const result = mapIntentToSearchParams({ maxBedrooms: 5 });
        expect(result.maxBedrooms).toBe('5');
        expect(result.minBedrooms).toBeUndefined();
    });
});

// ─── Bathroom count ───────────────────────────────────────────────────────────

describe('mapIntentToSearchParams — bathroom count', () => {
    it('both minBathrooms and maxBathrooms in valid range → both emitted', () => {
        const result = mapIntentToSearchParams({ minBathrooms: 1, maxBathrooms: 2 });
        expect(result.minBathrooms).toBe('1');
        expect(result.maxBathrooms).toBe('2');
    });

    it('conflict: minBathrooms > maxBathrooms → drops maxBathrooms (§5.3 expanded row)', () => {
        const result = mapIntentToSearchParams({ minBathrooms: 3, maxBathrooms: 1 });
        expect(result.minBathrooms).toBe('3');
        expect(result.maxBathrooms).toBeUndefined();
    });

    it('equal minBathrooms == maxBathrooms → both emitted', () => {
        const result = mapIntentToSearchParams({ minBathrooms: 2, maxBathrooms: 2 });
        expect(result.minBathrooms).toBe('2');
        expect(result.maxBathrooms).toBe('2');
    });

    it('only minBathrooms → emitted without maxBathrooms', () => {
        const result = mapIntentToSearchParams({ minBathrooms: 1 });
        expect(result.minBathrooms).toBe('1');
        expect(result.maxBathrooms).toBeUndefined();
    });

    it('only maxBathrooms → emitted without minBathrooms', () => {
        const result = mapIntentToSearchParams({ maxBathrooms: 3 });
        expect(result.maxBathrooms).toBe('3');
        expect(result.minBathrooms).toBeUndefined();
    });
});

// ─── Price ────────────────────────────────────────────────────────────────────

describe('mapIntentToSearchParams — price', () => {
    it('valid price range → both minPrice and maxPrice emitted', () => {
        const result = mapIntentToSearchParams({ minPrice: 50, maxPrice: 200 });
        expect(result.minPrice).toBe('50');
        expect(result.maxPrice).toBe('200');
    });

    it('AC-14/§5.3: conflicting price (minPrice > maxPrice) → both dropped', () => {
        const result = mapIntentToSearchParams({ minPrice: 300, maxPrice: 100 });
        expect(result.minPrice).toBeUndefined();
        expect(result.maxPrice).toBeUndefined();
    });

    it('equal minPrice == maxPrice → both emitted', () => {
        const result = mapIntentToSearchParams({ minPrice: 100, maxPrice: 100 });
        expect(result.minPrice).toBe('100');
        expect(result.maxPrice).toBe('100');
    });

    it('only minPrice set → emitted without maxPrice', () => {
        const result = mapIntentToSearchParams({ minPrice: 50 });
        expect(result.minPrice).toBe('50');
        expect(result.maxPrice).toBeUndefined();
    });

    it('only maxPrice set → emitted without minPrice', () => {
        const result = mapIntentToSearchParams({ maxPrice: 150 });
        expect(result.maxPrice).toBe('150');
        expect(result.minPrice).toBeUndefined();
    });

    it('zero minPrice → emitted (valid non-negative value)', () => {
        const result = mapIntentToSearchParams({ minPrice: 0, maxPrice: 100 });
        expect(result.minPrice).toBe('0');
    });
});

// ─── Currency ─────────────────────────────────────────────────────────────────

describe('mapIntentToSearchParams — currency', () => {
    it('currency emitted when minPrice present (§5.3)', () => {
        const result = mapIntentToSearchParams({ minPrice: 50, currency: PriceCurrencyEnum.USD });
        expect(result.currency).toBe('USD');
    });

    it('currency emitted when maxPrice present', () => {
        const result = mapIntentToSearchParams({ maxPrice: 200, currency: PriceCurrencyEnum.ARS });
        expect(result.currency).toBe('ARS');
    });

    it('currency emitted when both prices present in valid range', () => {
        const result = mapIntentToSearchParams({
            minPrice: 50,
            maxPrice: 200,
            currency: PriceCurrencyEnum.USD
        });
        expect(result.currency).toBe('USD');
    });

    it('currency NOT emitted when both prices dropped (conflict)', () => {
        const result = mapIntentToSearchParams({
            minPrice: 300,
            maxPrice: 100,
            currency: PriceCurrencyEnum.USD
        });
        expect(result.currency).toBeUndefined();
    });

    it('currency NOT emitted when no price params at all', () => {
        const result = mapIntentToSearchParams({ currency: PriceCurrencyEnum.USD });
        expect(result.currency).toBeUndefined();
    });
});

// ─── Rating ───────────────────────────────────────────────────────────────────

describe('mapIntentToSearchParams — rating', () => {
    it('valid rating range → both emitted', () => {
        const result = mapIntentToSearchParams({ minRating: 3, maxRating: 5 });
        expect(result.minRating).toBe('3');
        expect(result.maxRating).toBe('5');
    });

    it('AC-15: rating values clamped to [0, 5]', () => {
        const result = mapIntentToSearchParams({ minRating: -1, maxRating: 6 });
        expect(result.minRating).toBe('0');
        expect(result.maxRating).toBe('5');
    });

    it('AC-16: after clamping minRating > maxRating → maxRating dropped', () => {
        // minRating=4, maxRating=2 → clamped same values, min > max → drop maxRating
        const result = mapIntentToSearchParams({ minRating: 4, maxRating: 2 });
        expect(result.minRating).toBe('4');
        expect(result.maxRating).toBeUndefined();
    });

    it('equal minRating == maxRating (after clamp) → both emitted', () => {
        const result = mapIntentToSearchParams({ minRating: 3, maxRating: 3 });
        expect(result.minRating).toBe('3');
        expect(result.maxRating).toBe('3');
    });

    it('only minRating → emitted without maxRating', () => {
        const result = mapIntentToSearchParams({ minRating: 3.5 });
        expect(result.minRating).toBe('3.5');
        expect(result.maxRating).toBeUndefined();
    });

    it('only maxRating → emitted without minRating', () => {
        const result = mapIntentToSearchParams({ maxRating: 4 });
        expect(result.maxRating).toBe('4');
        expect(result.minRating).toBeUndefined();
    });

    it('only maxRating with no minRating → maxRating emitted (no min to compare against)', () => {
        const result = mapIntentToSearchParams({ maxRating: 1 });
        expect(result.maxRating).toBe('1');
    });
});

// ─── Boolean amenity shortcuts ────────────────────────────────────────────────

describe('mapIntentToSearchParams — boolean amenity shortcuts', () => {
    it('AC-2 / §8.1: hasPool true → "true" string (not boolean)', () => {
        const result = mapIntentToSearchParams({ hasPool: true });
        expect(result.hasPool).toBe('true');
        expect(typeof result.hasPool).toBe('string');
    });

    it('hasWifi true → "true" string (not boolean)', () => {
        const result = mapIntentToSearchParams({ hasWifi: true });
        expect(result.hasWifi).toBe('true');
        expect(typeof result.hasWifi).toBe('string');
    });

    it('allowsPets true → "true" string (not boolean)', () => {
        const result = mapIntentToSearchParams({ allowsPets: true });
        expect(result.allowsPets).toBe('true');
        expect(typeof result.allowsPets).toBe('string');
    });

    it('hasParking true → "true" string (not boolean)', () => {
        const result = mapIntentToSearchParams({ hasParking: true });
        expect(result.hasParking).toBe('true');
        expect(typeof result.hasParking).toBe('string');
    });

    it('hasPool false → omitted (not "false")', () => {
        const result = mapIntentToSearchParams({ hasPool: false });
        expect(result.hasPool).toBeUndefined();
    });

    it('hasWifi undefined → omitted', () => {
        const result = mapIntentToSearchParams({});
        expect(result.hasWifi).toBeUndefined();
    });
});

// ─── Amenities ────────────────────────────────────────────────────────────────

describe('mapIntentToSearchParams — amenities', () => {
    it('AC-19: resolved amenity IDs forwarded to amenities param', () => {
        const ids = ['uuid-001', 'uuid-002'];
        const result = mapIntentToSearchParams({}, ids);
        expect(result.amenities).toEqual(ids);
    });

    it('empty resolvedAmenityIds → amenities omitted', () => {
        const result = mapIntentToSearchParams({}, []);
        expect(result.amenities).toBeUndefined();
    });

    it('default resolvedAmenityIds (not passed) → amenities omitted', () => {
        const result = mapIntentToSearchParams({});
        expect(result.amenities).toBeUndefined();
    });

    it('resolvedAmenityIds immutably copied (mutation of input does not affect output)', () => {
        const ids = ['uuid-a'];
        const result = mapIntentToSearchParams({}, ids);
        ids.push('uuid-b');
        expect((result.amenities as string[]).length).toBe(1);
    });
});

// ─── Features ─────────────────────────────────────────────────────────────────

describe('mapIntentToSearchParams — features', () => {
    it('resolved feature IDs forwarded to features param', () => {
        const ids = ['feat-001', 'feat-002'];
        const result = mapIntentToSearchParams({}, [], ids);
        expect(result.features).toEqual(ids);
    });

    it('empty resolvedFeatureIds → features omitted', () => {
        const result = mapIntentToSearchParams({}, [], []);
        expect(result.features).toBeUndefined();
    });

    it('default resolvedFeatureIds (not passed) → features omitted', () => {
        const result = mapIntentToSearchParams({});
        expect(result.features).toBeUndefined();
    });
});

// ─── Availability dates ───────────────────────────────────────────────────────

describe('mapIntentToSearchParams — availability dates', () => {
    it('valid date range → both emitted as ISO YYYY-MM-DD strings', () => {
        const result = mapIntentToSearchParams({ checkIn: '2026-07-01', checkOut: '2026-07-08' });
        expect(result.checkIn).toBe('2026-07-01');
        expect(result.checkOut).toBe('2026-07-08');
    });

    it('AC-19: checkOut <= checkIn (same date) → both dropped', () => {
        const result = mapIntentToSearchParams({ checkIn: '2026-07-01', checkOut: '2026-07-01' });
        expect(result.checkIn).toBeUndefined();
        expect(result.checkOut).toBeUndefined();
    });

    it('checkOut before checkIn → both dropped', () => {
        const result = mapIntentToSearchParams({ checkIn: '2026-07-10', checkOut: '2026-07-05' });
        expect(result.checkIn).toBeUndefined();
        expect(result.checkOut).toBeUndefined();
    });

    it('only checkIn provided → emitted alone', () => {
        const result = mapIntentToSearchParams({ checkIn: '2026-08-01' });
        expect(result.checkIn).toBe('2026-08-01');
        expect(result.checkOut).toBeUndefined();
    });

    it('only checkOut provided → emitted alone', () => {
        const result = mapIntentToSearchParams({ checkOut: '2026-08-15' });
        expect(result.checkOut).toBe('2026-08-15');
        expect(result.checkIn).toBeUndefined();
    });
});

// ─── Whitelist enforcement / unknown slots ────────────────────────────────────

describe('mapIntentToSearchParams — whitelist enforcement', () => {
    it('AC-5: unknown extra keys on entities are NOT forwarded', () => {
        // Simulate model returning an extra hallucinated field.
        // Cast through unknown to allow injecting non-typed field for test.
        const entities = {
            minGuests: 2,
            vibe: 'romantic'
        } as unknown as Parameters<typeof mapIntentToSearchParams>[0];
        const result = mapIntentToSearchParams(entities);
        expect(result.minGuests).toBe('2');
        expect('vibe' in result).toBe(false);
    });

    it('locationType internal hint is never emitted', () => {
        const entities = { locationType: 'city' as const, city: 'Rosario' };
        const result = mapIntentToSearchParams(entities);
        expect('locationType' in result).toBe(false);
        // city IS emitted as q
        expect(result.q).toBe('Rosario');
    });

    it('amenitySlugs internal hint is never emitted as a param', () => {
        const entities = { amenitySlugs: ['pool', 'wifi'] };
        const result = mapIntentToSearchParams(entities);
        expect('amenitySlugs' in result).toBe(false);
        // resolvedAmenityIds default is [] → amenities omitted
        expect(result.amenities).toBeUndefined();
    });

    it('featureSlugs internal hint is never emitted as a param', () => {
        const entities = { featureSlugs: ['beach', 'mountain'] };
        const result = mapIntentToSearchParams(entities);
        expect('featureSlugs' in result).toBe(false);
        expect(result.features).toBeUndefined();
    });

    it('empty entities object returns empty record', () => {
        const result = mapIntentToSearchParams({});
        expect(Object.keys(result)).toHaveLength(0);
    });
});

// ─── AC-2 composite: full example from spec ──────────────────────────────────

describe('mapIntentToSearchParams — AC-2 composite test', () => {
    it('entities from §7 AC-2 produce the expected mapped params', () => {
        // Arrange: { minGuests: 4, hasPool: true, accommodationType: 'CABIN' }
        const entities = {
            minGuests: 4,
            hasPool: true,
            accommodationType: AccommodationTypeEnum.CABIN
        };

        // Act
        const result = mapIntentToSearchParams(entities);

        // Assert
        expect(result.minGuests).toBe('4');
        expect(result.hasPool).toBe('true');
        expect(result.type).toBe('CABIN');
    });
});

// ─── Full slot coverage smoke test ───────────────────────────────────────────

describe('mapIntentToSearchParams — full slot output keys', () => {
    it('all expected output keys present for a maximal entity set', () => {
        const entities = {
            destinationId: 'b0000000-0000-4000-8000-000000000001',
            accommodationType: AccommodationTypeEnum.APARTMENT,
            minGuests: 2,
            maxGuests: 4,
            minBedrooms: 1,
            maxBedrooms: 3,
            minBathrooms: 1,
            maxBathrooms: 2,
            minPrice: 50,
            maxPrice: 200,
            currency: PriceCurrencyEnum.USD,
            minRating: 3,
            maxRating: 5,
            hasPool: true,
            hasWifi: true,
            allowsPets: true,
            hasParking: true,
            checkIn: '2026-09-01',
            checkOut: '2026-09-10'
        };

        const result = mapIntentToSearchParams(entities, ['a-uuid-1'], ['f-uuid-1']);

        expect(result.destinationId).toBe('b0000000-0000-4000-8000-000000000001');
        expect(result.type).toBe('APARTMENT');
        expect(result.minGuests).toBe('2');
        expect(result.maxGuests).toBe('4');
        expect(result.minBedrooms).toBe('1');
        expect(result.maxBedrooms).toBe('3');
        expect(result.minBathrooms).toBe('1');
        expect(result.maxBathrooms).toBe('2');
        expect(result.minPrice).toBe('50');
        expect(result.maxPrice).toBe('200');
        expect(result.currency).toBe('USD');
        expect(result.minRating).toBe('3');
        expect(result.maxRating).toBe('5');
        expect(result.hasPool).toBe('true');
        expect(result.hasWifi).toBe('true');
        expect(result.allowsPets).toBe('true');
        expect(result.hasParking).toBe('true');
        expect(result.amenities).toEqual(['a-uuid-1']);
        expect(result.features).toEqual(['f-uuid-1']);
        expect(result.checkIn).toBe('2026-09-01');
        expect(result.checkOut).toBe('2026-09-10');
    });
});
