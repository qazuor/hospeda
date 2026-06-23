/**
 * Tests for the amenity slug resolver (SPEC-222 T-012, updated SPEC-266 T-003)
 *
 * Covers:
 * - Two slugs that both resolve → two ids, empty unresolved.
 * - A slug with no catalog match → goes to unresolved.
 * - A fuzzy/partial-only hit (returned item slug !== exact input) → unresolved.
 * - Duplicate input slugs → resolved ids de-duped.
 * - `searchForList` throws for one slug → that slug unresolved, others still
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
 * slug is `slug` and whose id is `id`.
 *
 * The `name` JSONB column was dropped in SPEC-266 T-001. Resolution now
 * matches against `slug` directly.
 */
function makeSearchResult(id: string, slug: string): AmenitySearchForListOutput {
    return {
        data: [
            {
                id,
                slug,
                description: null,
                applicableVerticals: ['accommodation'],
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

    describe('when both slugs resolve to catalog entries', () => {
        it('should return two ids and an empty unresolved array', async () => {
            // Arrange
            const wifiId = 'uuid-wifi-001';
            const poolId = 'uuid-pool-001';
            const searchForList = vi
                .fn()
                .mockImplementationOnce(async () => makeSearchResult(wifiId, 'wifi'))
                .mockImplementationOnce(async () => makeSearchResult(poolId, 'piscina'));

            // Act
            const result = await resolveAmenities({
                names: ['wifi', 'piscina'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert
            expect(result.amenityIds).toEqual([wifiId, poolId]);
            expect(result.unresolved).toEqual([]);
        });
    });

    describe('when a slug has no catalog match', () => {
        it('should push the original slug to unresolved', async () => {
            // Arrange
            const searchForList = vi.fn().mockResolvedValue(emptySearchResult);

            // Act
            const result = await resolveAmenities({
                names: ['unknown_amenity'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert
            expect(result.amenityIds).toEqual([]);
            expect(result.unresolved).toEqual(['unknown_amenity']);
        });
    });

    describe('when a result item is a fuzzy/partial-only match (slug does not equal input exactly)', () => {
        it('should treat the slug as unresolved instead of auto-resolving to the partial match', async () => {
            // Arrange — search for "pool" returns "rooftop_pool" (ILIKE hit but NOT exact match)
            const searchForList = vi
                .fn()
                .mockResolvedValue(makeSearchResult('uuid-rooftop-pool', 'rooftop_pool'));

            // Act
            const result = await resolveAmenities({
                names: ['pool'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — strict exact-CI rule rejects "rooftop_pool" ≠ "pool"
            expect(result.amenityIds).toEqual([]);
            expect(result.unresolved).toEqual(['pool']);
        });
    });

    describe('when input names contains duplicates', () => {
        it('should de-duplicate resolved ids so each id appears only once', async () => {
            // Arrange — "wifi" repeated twice maps to the same catalog entry
            const wifiId = 'uuid-wifi-001';
            const searchForList = vi
                .fn()
                // First call: exact match for "wifi"
                .mockResolvedValueOnce(makeSearchResult(wifiId, 'wifi'))
                // Second call would not be made due to de-dup at input level
                .mockResolvedValueOnce(makeSearchResult(wifiId, 'piscina'));

            // Act — same slug repeated twice
            const result = await resolveAmenities({
                names: ['wifi', 'wifi'],
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

            // Act — same unknown slug repeated three times
            const result = await resolveAmenities({
                names: ['ghost', 'ghost', 'ghost'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — searched once, unresolved once
            expect(searchForList).toHaveBeenCalledTimes(1);
            expect(result.unresolved).toEqual(['ghost']);
        });
    });

    describe('when searchForList throws for one slug', () => {
        it('should push that slug to unresolved, continue processing others, and not throw', async () => {
            // Arrange
            const parkingId = 'uuid-parking-001';
            const searchForList = vi
                .fn()
                // First slug ("wifi") — throws
                .mockRejectedValueOnce(new Error('DB connection lost'))
                // Second slug ("estacionamiento") — resolves successfully
                .mockResolvedValueOnce(makeSearchResult(parkingId, 'estacionamiento'));

            // Act
            const result = await resolveAmenities({
                names: ['wifi', 'estacionamiento'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — wifi went to unresolved, estacionamiento was resolved
            expect(result.amenityIds).toEqual([parkingId]);
            expect(result.unresolved).toEqual(['wifi']);
        });
    });

    describe('case-insensitive matching', () => {
        it('should resolve "WiFi" (mixed case input) against a catalog entry with slug "wifi"', async () => {
            // Arrange
            const wifiId = 'uuid-wifi-001';
            const searchForList = vi.fn().mockResolvedValue(makeSearchResult(wifiId, 'wifi'));

            // Act — input is mixed-case
            const result = await resolveAmenities({
                names: ['WiFi'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — "WiFi".toLowerCase() === "wifi" → match
            expect(result.amenityIds).toEqual([wifiId]);
            expect(result.unresolved).toEqual([]);
        });

        it('should resolve "  wifi  " (padded input) against a catalog entry with slug "wifi"', async () => {
            // Arrange
            const wifiId = 'uuid-wifi-001';
            const searchForList = vi.fn().mockResolvedValue(makeSearchResult(wifiId, 'wifi'));

            // Act — input has leading/trailing whitespace
            const result = await resolveAmenities({
                names: ['  wifi  '],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — trim() normalises both sides before comparison
            expect(result.amenityIds).toEqual([wifiId]);
            expect(result.unresolved).toEqual([]);
        });
    });
});
