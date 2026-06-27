/**
 * Tests for the amenity resolver (SPEC-222 T-012, enhanced SPEC-258, updated SPEC-266 T-003)
 *
 * Covers:
 * - Two slugs that both resolve → two ids, empty unresolved.
 * - A slug with no catalog match → goes to unresolved.
 * - A fuzzy/partial-only hit (returned item slug !== exact input) → unresolved.
 * - Duplicate input slugs → resolved ids de-duped.
 * - `searchForList` throws for one slug → that slug unresolved, others still
 *   processed, no throw.
 * - Empty `names` → `{ amenityIds: [], unresolved: [] }`.
 * - [SPEC-258] Synonym lookup: "pileta" → synonym resolves to slug "pool" →
 *   catalog lookup via slug → returns the pool UUID.
 * - [SPEC-258] Accent-variant matching: "Calefacción" normalizes to "calefaccion"
 *   and matches slug = "calefaccion" (the catalog slug).
 * - [SPEC-258] A genuinely unknown term still goes to unresolved (no regression).
 * - [SPEC-258] Existing exact-ES matches still work (no regression).
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

    // -------------------------------------------------------------------------
    // SPEC-258: normalization + synonym matching
    // -------------------------------------------------------------------------

    describe('[SPEC-258] accent normalization', () => {
        it('should resolve "Calefacción" (with accent) against catalog slug "calefaccion"', async () => {
            // Arrange — catalog stores slug = "calefaccion" (the slug, no accent).
            // The resolver normalizes the scraped input ("Calefacción" → "calefaccion")
            // and matches it against the normalized slug.
            const heatingId = 'uuid-heating-001';
            const searchForList = vi
                .fn()
                .mockResolvedValue(makeSearchResult(heatingId, 'calefaccion'));

            // Act — input has a Spanish accent
            const result = await resolveAmenities({
                names: ['Calefacción'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — normalization strips the accent → "calefaccion" matches slug
            expect(result.amenityIds).toEqual([heatingId]);
            expect(result.unresolved).toEqual([]);
        });
    });

    describe('[SPEC-258] synonym lookup', () => {
        it('should resolve "pileta" to the pool catalog entry via synonym map', async () => {
            // Arrange — the resolver will:
            //   1. normalize "pileta" → "pileta" (no change)
            //   2. check direct match against all locales → no match
            //   3. look up synonym map: "pileta" → slug "pool"
            //   4. search for "pool" → find the catalog entry → return its id
            const poolId = 'uuid-pool-003';
            const searchForList = vi
                .fn()
                // First call: searching "pileta" — returns empty (no catalog entry named "pileta")
                .mockResolvedValueOnce({
                    data: [],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 0,
                        totalPages: 0,
                        hasNextPage: false,
                        hasPreviousPage: false
                    }
                })
                // Second call: synonym-driven slug lookup "pool" → returns the pool entry
                .mockResolvedValueOnce(makeSearchResult(poolId, 'pool'));

            // Act
            const result = await resolveAmenities({
                names: ['pileta'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — pileta was resolved to the pool UUID via the synonym map
            expect(result.amenityIds).toEqual([poolId]);
            expect(result.unresolved).toEqual([]);
        });

        it('should resolve "Wi-Fi" to the wifi catalog entry via synonym map', async () => {
            // Arrange — "Wi-Fi" normalizes to "wi-fi" which maps to slug "wifi"
            const wifiId = 'uuid-wifi-synonym-001';
            const searchForList = vi
                .fn()
                // First call: direct search for "Wi-Fi" — no match (catalog name is "wifi")
                .mockResolvedValueOnce({
                    data: [],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 0,
                        totalPages: 0,
                        hasNextPage: false,
                        hasPreviousPage: false
                    }
                })
                // Second call: slug lookup "wifi" → match
                .mockResolvedValueOnce(makeSearchResult(wifiId, 'wifi'));

            // Act
            const result = await resolveAmenities({
                names: ['Wi-Fi'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert
            expect(result.amenityIds).toEqual([wifiId]);
            expect(result.unresolved).toEqual([]);
        });

        it('should resolve "Piscina" (cross-locale variant) via synonym + normalization', async () => {
            // Arrange — "Piscina" normalizes to "piscina" → synonym → slug "pool"
            const poolId = 'uuid-pool-piscina-001';
            const searchForList = vi
                .fn()
                // First call: direct search for "Piscina" — no match
                .mockResolvedValueOnce({
                    data: [],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 0,
                        totalPages: 0,
                        hasNextPage: false,
                        hasPreviousPage: false
                    }
                })
                // Second call: slug lookup "pool" → match
                .mockResolvedValueOnce(makeSearchResult(poolId, 'pool'));

            // Act
            const result = await resolveAmenities({
                names: ['Piscina'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert
            expect(result.amenityIds).toEqual([poolId]);
            expect(result.unresolved).toEqual([]);
        });

        it('should not resolve a genuinely unknown term — still goes to unresolved', async () => {
            // Arrange — no synonym match, no catalog match
            const searchForList = vi.fn().mockResolvedValue({
                data: [],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            });

            // Act
            const result = await resolveAmenities({
                names: ['XenomorphNest'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — unknown term still flows to unresolved (conservative contract)
            expect(result.amenityIds).toEqual([]);
            expect(result.unresolved).toEqual(['XenomorphNest']);
        });

        it('should not make an extra search when synonym slug search also returns no match', async () => {
            // Arrange — "cochera" synonymizes to "parking" slug; slug search returns empty
            const searchForList = vi.fn().mockResolvedValue({
                data: [],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            });

            // Act
            const result = await resolveAmenities({
                names: ['cochera'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — cochera goes to unresolved when slug "parking" is not in catalog
            expect(result.amenityIds).toEqual([]);
            expect(result.unresolved).toEqual(['cochera']);
            // Two calls: one for original term, one for slug
            expect(searchForList).toHaveBeenCalledTimes(2);
        });
    });

    describe('[SPEC-258] regression — existing exact-ES matches still work', () => {
        it('should still resolve "WiFi" when catalog slug === "WiFi" (original behavior)', async () => {
            // Arrange — catalog stores slug = "WiFi" (exact match, original behavior)
            const wifiId = 'uuid-wifi-regression-001';
            const searchForList = vi.fn().mockResolvedValue(makeSearchResult(wifiId, 'WiFi'));

            // Act
            const result = await resolveAmenities({
                names: ['WiFi'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — original exact-ES path still works, no regression
            expect(result.amenityIds).toEqual([wifiId]);
            expect(result.unresolved).toEqual([]);
        });

        it('should still reject a partial/fuzzy-only hit (no regression on conservative contract)', async () => {
            // Arrange — search returns "Rooftop Pool" when looking for "Pool"
            const searchForList = vi
                .fn()
                .mockResolvedValue(makeSearchResult('uuid-rooftop-pool', 'Rooftop Pool'));

            // Act
            const result = await resolveAmenities({
                names: ['Pool'],
                amenityService: { searchForList },
                actor: fakeActor
            });

            // Assert — "Rooftop Pool" ≠ "Pool" in any locale → unresolved (conservative)
            expect(result.amenityIds).toEqual([]);
            expect(result.unresolved).toEqual(['Pool']);
        });
    });
});
