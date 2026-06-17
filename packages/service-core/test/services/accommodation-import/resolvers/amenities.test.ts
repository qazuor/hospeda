/**
 * Tests for the amenity name resolver (SPEC-222 T-012)
 *
 * Covers:
 * - Two names that both resolve → two ids, empty unresolved.
 * - A name with no catalog match → goes to unresolved.
 * - A fuzzy/partial-only hit (returned item name !== exact input) → unresolved.
 * - Duplicate input names → resolved ids de-duped.
 * - `searchForList` throws for one name → that name unresolved, others still
 *   processed, no throw.
 * - Empty `names` → `{ amenityIds: [], unresolved: [] }`.
 */

import type { AmenitySearchForListOutput } from '@repo/schemas';
import { AmenitiesTypeEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { resolveAmenities } from '../../../../src/services/accommodation-import/resolvers/amenities.js';
import type { Actor } from '../../../../src/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal AmenitySearchForListOutput with a single item whose
 * Spanish name is `esName` and whose id is `id`.
 */
function makeSearchResult(id: string, esName: string): AmenitySearchForListOutput {
    return {
        data: [
            {
                id,
                slug: esName.toLowerCase().replace(/\s+/g, '-'),
                name: { es: esName, en: esName, pt: esName },
                description: null,
                type: AmenitiesTypeEnum.CONNECTIVITY,
                icon: null,
                isBuiltin: false,
                isFeatured: false,
                displayWeight: 50,
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
                usageCount: 0,
                accommodationCount: 0
            }
        ],
        pagination: {
            page: 1,
            pageSize: 10,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false
        }
    };
}

/** An empty search result — no catalog entries found. */
const emptySearchResult: AmenitySearchForListOutput = {
    data: [],
    pagination: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
    }
};

/** Minimal fake Actor used across all tests. */
const fakeActor: Actor = {
    id: 'actor-uuid-001',
    role: 'ADMIN',
    permissions: ['amenity.view']
} as unknown as Actor;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveAmenities', () => {
    describe('when given an empty names array', () => {
        it('should return empty amenityIds and empty unresolved without calling searchForList', async () => {
            // Arrange
            const searchForList = vi.fn();

            // Act
            const result = await resolveAmenities({
                names: [],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert
            expect(result).toEqual({ amenityIds: [], unresolved: [] });
            expect(searchForList).not.toHaveBeenCalled();
        });
    });

    describe('when both names resolve to catalog entries', () => {
        it('should return two ids and an empty unresolved array', async () => {
            // Arrange
            const wifiId = 'uuid-wifi-001';
            const poolId = 'uuid-pool-001';
            const searchForList = vi
                .fn()
                .mockImplementationOnce(async () => makeSearchResult(wifiId, 'WiFi'))
                .mockImplementationOnce(async () => makeSearchResult(poolId, 'Piscina'));

            // Act
            const result = await resolveAmenities({
                names: ['WiFi', 'Piscina'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert
            expect(result.amenityIds).toEqual([wifiId, poolId]);
            expect(result.unresolved).toEqual([]);
        });
    });

    describe('when a name has no catalog match', () => {
        it('should push the original name to unresolved', async () => {
            // Arrange
            const searchForList = vi.fn().mockResolvedValue(emptySearchResult);

            // Act
            const result = await resolveAmenities({
                names: ['UnknownAmenity'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert
            expect(result.amenityIds).toEqual([]);
            expect(result.unresolved).toEqual(['UnknownAmenity']);
        });
    });

    describe('when a result item is a fuzzy/partial-only match (name does not equal input exactly)', () => {
        it('should treat the name as unresolved instead of auto-resolving to the partial match', async () => {
            // Arrange — search for "Pool" returns "Rooftop Pool" (ILIKE hit but NOT exact match)
            const searchForList = vi
                .fn()
                .mockResolvedValue(makeSearchResult('uuid-rooftop-pool', 'Rooftop Pool'));

            // Act
            const result = await resolveAmenities({
                names: ['Pool'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — strict exact-CI rule rejects "Rooftop Pool" ≠ "Pool"
            expect(result.amenityIds).toEqual([]);
            expect(result.unresolved).toEqual(['Pool']);
        });
    });

    describe('when input names contains duplicates', () => {
        it('should de-duplicate resolved ids so each id appears only once', async () => {
            // Arrange — both "WiFi" and "WIFI" (case variant) resolve to the same catalog entry
            const wifiId = 'uuid-wifi-001';
            const searchForList = vi
                .fn()
                // First call: exact match for "WiFi"
                .mockResolvedValueOnce(makeSearchResult(wifiId, 'WiFi'))
                // Second call: same id returned — different scraped casing, same catalog entry
                .mockResolvedValueOnce(makeSearchResult(wifiId, 'Piscina')); // won't be called

            // Act — same name repeated twice
            const result = await resolveAmenities({
                names: ['WiFi', 'WiFi'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — searchForList called once (de-dup at input level), id appears once
            expect(searchForList).toHaveBeenCalledTimes(1);
            expect(result.amenityIds).toEqual([wifiId]);
            expect(result.unresolved).toEqual([]);
        });

        it('should de-duplicate unresolved names so each name appears only once', async () => {
            // Arrange
            const searchForList = vi.fn().mockResolvedValue(emptySearchResult);

            // Act — same unknown name repeated three times
            const result = await resolveAmenities({
                names: ['Ghost', 'Ghost', 'Ghost'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — searched once, unresolved once
            expect(searchForList).toHaveBeenCalledTimes(1);
            expect(result.unresolved).toEqual(['Ghost']);
        });
    });

    describe('when searchForList throws for one name', () => {
        it('should push that name to unresolved, continue processing others, and not throw', async () => {
            // Arrange
            const parkingId = 'uuid-parking-001';
            const searchForList = vi
                .fn()
                // First name ("WiFi") — throws
                .mockRejectedValueOnce(new Error('DB connection lost'))
                // Second name ("Estacionamiento") — resolves successfully
                .mockResolvedValueOnce(makeSearchResult(parkingId, 'Estacionamiento'));

            // Act
            const result = await resolveAmenities({
                names: ['WiFi', 'Estacionamiento'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — WiFi went to unresolved, Estacionamiento was resolved
            expect(result.amenityIds).toEqual([parkingId]);
            expect(result.unresolved).toEqual(['WiFi']);
        });
    });

    describe('case-insensitive matching', () => {
        it('should resolve "wifi" (lowercase input) against a catalog entry named "WiFi"', async () => {
            // Arrange
            const wifiId = 'uuid-wifi-001';
            const searchForList = vi.fn().mockResolvedValue(makeSearchResult(wifiId, 'WiFi'));

            // Act — input is all-lowercase
            const result = await resolveAmenities({
                names: ['wifi'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — "wifi".toLowerCase() === "WiFi".toLowerCase() → match
            expect(result.amenityIds).toEqual([wifiId]);
            expect(result.unresolved).toEqual([]);
        });

        it('should resolve "  WiFi  " (padded input) against a catalog entry named "WiFi"', async () => {
            // Arrange
            const wifiId = 'uuid-wifi-001';
            const searchForList = vi.fn().mockResolvedValue(makeSearchResult(wifiId, 'WiFi'));

            // Act — input has leading/trailing whitespace
            const result = await resolveAmenities({
                names: ['  WiFi  '],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — trim() normalises both sides before comparison
            expect(result.amenityIds).toEqual([wifiId]);
            expect(result.unresolved).toEqual([]);
        });
    });
});
