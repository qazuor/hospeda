/**
 * Tests for accommodation-import destination hint resolver (SPEC-222)
 *
 * Verifies that {@link buildDestinationHint}:
 * - Returns candidate destinations from search results.
 * - Returns empty candidates when locality is absent/empty.
 * - Degrades gracefully on service errors.
 * - NEVER auto-selects a destinationId, even on a single exact match.
 */

import { DestinationSearchSchema } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';

import { buildDestinationHint } from '../../../../src/services/accommodation-import/resolvers/destination.js';
import type { DestinationService } from '../../../../src/services/destination/destination.service.js';
import type { Actor } from '../../../../src/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal Actor stub that satisfies the type requirement. */
const fakeActor: Actor = {
    id: 'actor-uuid-0001',
    permissions: [],
    role: 'HOST'
} as unknown as Actor;

/**
 * Builds a partial DestinationService mock with a controllable `search` stub.
 * Only the `search` method is needed by `buildDestinationHint`.
 */
function makeDestinationServiceMock(searchImpl: DestinationService['search']): DestinationService {
    return {
        search: searchImpl
    } as unknown as DestinationService;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildDestinationHint', () => {
    // -------------------------------------------------------------------------
    // Happy path — multiple matches
    // -------------------------------------------------------------------------
    describe('when locality matches multiple destinations', () => {
        it('should keep every candidate when none of them matches deterministically', async () => {
            // Arrange — an over-wide ILIKE: neither row is the scraped locality.
            const searchFn = vi.fn().mockResolvedValue({
                data: {
                    items: [
                        { id: 'dest-uuid-0001', name: 'Villa Elisa' },
                        { id: 'dest-uuid-0002', name: 'Villa Paranacito' }
                    ],
                    total: 2
                }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: 'Villa',
                destinationService,
                actor: fakeActor
            });

            // Assert — both are offered, and neither may pre-fill.
            expect(result.scrapedLocality).toBe('Villa');
            expect(result.candidates).toHaveLength(2);
            expect(result.confident).toBe(false);
        });

        it('should narrow an over-wide literal search to the verbatim catalog name', async () => {
            // Arrange — `ILIKE '%Gualeguay%'` matches Gualeguaychú too, so a
            // verbatim catalog name arrives as an ambiguous pair and would lose
            // its pre-fill (HOS-286 judgment-day).
            const searchFn = vi.fn().mockResolvedValue({
                data: {
                    items: [
                        { id: 'dest-uuid-0001', name: 'Gualeguay' },
                        { id: 'dest-uuid-0002', name: 'Gualeguaychú' }
                    ],
                    total: 2
                }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: 'Gualeguay',
                destinationService,
                actor: fakeActor
            });

            // Assert
            expect(result.candidates).toStrictEqual([{ id: 'dest-uuid-0001', name: 'Gualeguay' }]);
            expect(result.confident).toBe(true);
        });

        it('should forward q, searchScope:"name", pageSize, and page to the search call', async () => {
            // Arrange
            const searchFn = vi.fn().mockResolvedValue({
                data: { items: [], total: 0 }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            await buildDestinationHint({
                locality: 'Buenos Aires',
                destinationService,
                actor: fakeActor
            });

            // Assert — verify correct search parameters were forwarded
            expect(searchFn).toHaveBeenCalledWith(
                fakeActor,
                expect.objectContaining({
                    q: 'Buenos Aires',
                    searchScope: 'name',
                    pageSize: 5,
                    page: 1
                })
            );
        });

        it('should NOT pass country to the search even when provided (SPEC-257)', async () => {
            // Arrange — the destinations table has no `country` column; passing a
            // country filter throws a DbError ("unknown columns") and returns zero
            // candidates. The resolver must search by locality name alone.
            const searchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            await buildDestinationHint({
                locality: 'Concepción del Uruguay',
                country: 'Argentina',
                destinationService,
                actor: fakeActor
            });

            // Assert — no country key forwarded to the search
            const passed = searchFn.mock.calls[0]?.[1] as Record<string, unknown>;
            expect(passed).not.toHaveProperty('country');
            expect(passed).toMatchObject({ q: 'Concepción del Uruguay', searchScope: 'name' });
        });
    });

    // -------------------------------------------------------------------------
    // No match
    // -------------------------------------------------------------------------
    describe('when locality produces no search matches', () => {
        it('should return empty candidates and still set scrapedLocality', async () => {
            // Arrange
            const searchFn = vi.fn().mockResolvedValue({
                data: { items: [], total: 0 }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: 'NowhereVille',
                destinationService,
                actor: fakeActor
            });

            // Assert
            expect(result.scrapedLocality).toBe('NowhereVille');
            expect(result.candidates).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // Absent / empty locality — search must NOT be called
    // -------------------------------------------------------------------------
    describe('when locality is absent or empty', () => {
        it('should return { candidates: [] } and NOT call search when locality is undefined', async () => {
            // Arrange
            const searchFn = vi.fn();
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: undefined,
                destinationService,
                actor: fakeActor
            });

            // Assert
            expect(result).toStrictEqual({ candidates: [], confident: false });
            expect(searchFn).not.toHaveBeenCalled();
        });

        it('should return { candidates: [] } and NOT call search when locality is an empty string', async () => {
            // Arrange
            const searchFn = vi.fn();
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: '',
                destinationService,
                actor: fakeActor
            });

            // Assert
            expect(result).toStrictEqual({ candidates: [], confident: false });
            expect(searchFn).not.toHaveBeenCalled();
        });

        it('should return { candidates: [] } and NOT call search when locality is whitespace only', async () => {
            // Arrange
            const searchFn = vi.fn();
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: '   ',
                destinationService,
                actor: fakeActor
            });

            // Assert
            expect(result).toStrictEqual({ candidates: [], confident: false });
            expect(searchFn).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Error resilience
    // -------------------------------------------------------------------------
    describe('when the search service throws', () => {
        it('should return { scrapedLocality, candidates: [] } without re-throwing', async () => {
            // Arrange
            const searchFn = vi.fn().mockRejectedValue(new Error('DB connection lost'));
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act — must resolve without throwing
            const result = await buildDestinationHint({
                locality: 'Colón',
                destinationService,
                actor: fakeActor
            });

            // Assert
            expect(result).toStrictEqual({
                scrapedLocality: 'Colón',
                candidates: [],
                confident: false
            });
        });
    });

    describe('when the search service returns a service error', () => {
        it('should return { scrapedLocality, candidates: [] } without re-throwing', async () => {
            // Arrange
            const searchFn = vi.fn().mockResolvedValue({
                error: { code: 'INTERNAL_ERROR', message: 'unexpected failure' }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: 'Gualeguaychú',
                destinationService,
                actor: fakeActor
            });

            // Assert
            expect(result).toStrictEqual({
                scrapedLocality: 'Gualeguaychú',
                candidates: [],
                confident: false
            });
        });
    });

    // -------------------------------------------------------------------------
    // SPEC-222 AC-8.2 — NEVER auto-select destinationId
    // -------------------------------------------------------------------------
    describe('SPEC-222 AC-8.2 — never auto-select a destinationId', () => {
        it('should return a single exact match as a CANDIDATE and not return a bare destinationId', async () => {
            // Arrange — exactly one result to simulate an "obvious" match
            const searchFn = vi.fn().mockResolvedValue({
                data: {
                    items: [{ id: 'dest-uuid-exact', name: 'Concepción del Uruguay' }],
                    total: 1
                }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: 'Concepción del Uruguay',
                destinationService,
                actor: fakeActor
            });

            // Assert — candidate is present but NO auto-selected destinationId anywhere
            expect(result.candidates).toHaveLength(1);
            expect(result.candidates[0]).toStrictEqual({
                id: 'dest-uuid-exact',
                name: 'Concepción del Uruguay'
            });

            // The returned object must NOT carry a destinationId property at any level.
            expect(result).not.toHaveProperty('destinationId');

            // Verify the result has only the expected shape (candidates + optional scrapedLocality).
            const keys = Object.keys(result);
            expect(
                keys.every(
                    (k) => k === 'candidates' || k === 'scrapedLocality' || k === 'confident'
                )
            ).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // CITY scoping + normalized fallback (HOS-286)
    // -------------------------------------------------------------------------
    describe('CITY scoping and exact-name confidence (HOS-286)', () => {
        it('should send search params that the real DestinationSearchSchema accepts', async () => {
            // Arrange — every other test here mocks `search`, so a param the real
            // schema rejects (e.g. a pageSize over the .max(100) cap) would pass
            // them all and then silently resolve nothing in production.
            const searchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            await buildDestinationHint({
                locality: 'C. del Uruguay',
                destinationService,
                actor: fakeActor
            });

            // Assert
            for (const [, params] of searchFn.mock.calls) {
                const parsed = DestinationSearchSchema.safeParse(params);
                expect(
                    parsed.success,
                    `search params rejected by schema: ${JSON.stringify(params)}`
                ).toBe(true);
            }
        });

        it('should scope the search to CITY destinations', async () => {
            // Arrange
            const searchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            await buildDestinationHint({
                locality: 'Uruguay',
                destinationService,
                actor: fakeActor
            });

            // Assert — a DEPARTMENT/PROVINCE row must never be offered as the
            // destination of an accommodation; the host's own City picker
            // queries CITY only and could never produce one.
            expect(searchFn).toHaveBeenCalledWith(
                fakeActor,
                expect.objectContaining({ q: 'Uruguay', destinationType: 'CITY' })
            );
        });

        it('should mark a verbatim name match as confident', async () => {
            // Arrange
            const searchFn = vi.fn().mockResolvedValue({
                data: { items: [{ id: 'city-colon', name: 'Colón' }], total: 1 }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: 'Colón',
                destinationService,
                actor: fakeActor
            });

            // Assert
            expect(result.candidates).toStrictEqual([{ id: 'city-colon', name: 'Colón' }]);
            expect(result.confident).toBe(true);
        });

        it('should ignore accents and casing when comparing the name', async () => {
            // Arrange
            const searchFn = vi.fn().mockResolvedValue({
                data: { items: [{ id: 'city-gchu', name: 'Gualeguaychú' }], total: 1 }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: 'GUALEGUAYCHU',
                destinationService,
                actor: fakeActor
            });

            // Assert
            expect(result.confident).toBe(true);
        });

        it.each([
            // `safeIlike` is `%term%`, a raw SUBSTRING match run in Postgres.
            // Each of these returns exactly ONE CITY row — the shape the review
            // UI pre-fills — and each names a different, real place.
            ['Rosario', 'city-tala', 'Rosario del Tala'],
            ['Concepción', 'city-cdu', 'Concepción del Uruguay'],
            ['Salvador', 'city-sansalvador', 'San Salvador'],
            ['Uruguay', 'city-cdu', 'Concepción del Uruguay'],
            ['Liebig', 'city-liebig', 'Pueblo Liebig']
        ])('should NOT mark the substring hit %s -> %s as confident', async (locality, id, name) => {
            // Arrange
            const searchFn = vi
                .fn()
                .mockResolvedValue({ data: { items: [{ id, name }], total: 1 } });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality,
                destinationService,
                actor: fakeActor
            });

            // Assert — still offered as a suggestion, never pre-filled.
            expect(result.candidates).toStrictEqual([{ id, name }]);
            expect(result.confident).toBe(false);
        });

        it('should narrow an over-wide search to the verbatim name', async () => {
            // Arrange — `ILIKE '%Gualeguay%'` matches Gualeguaychú too, so a
            // verbatim catalog name would otherwise arrive as an ambiguous pair
            // and lose its pre-fill.
            const searchFn = vi.fn().mockResolvedValue({
                data: {
                    items: [
                        { id: 'city-gualeguay', name: 'Gualeguay' },
                        { id: 'city-gchu', name: 'Gualeguaychú' }
                    ],
                    total: 2
                }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: 'Gualeguay',
                destinationService,
                actor: fakeActor
            });

            // Assert
            expect(result.candidates).toStrictEqual([{ id: 'city-gualeguay', name: 'Gualeguay' }]);
            expect(result.confident).toBe(true);
        });

        it('should keep every candidate when none is a verbatim match', async () => {
            // Arrange
            const searchFn = vi.fn().mockResolvedValue({
                data: {
                    items: [
                        { id: 'city-elisa', name: 'Villa Elisa' },
                        { id: 'city-paranacito', name: 'Villa Paranacito' }
                    ],
                    total: 2
                }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: 'Villa',
                destinationService,
                actor: fakeActor
            });

            // Assert — both offered, neither may pre-fill.
            expect(result.candidates).toHaveLength(2);
            expect(result.confident).toBe(false);
        });

        it('should NOT be confident when the listing is in another country', async () => {
            // Arrange — "San José" names real cities in Uruguay, Costa Rica and
            // Entre Ríos. An exact NAME match is not an exact PLACE match.
            const searchFn = vi.fn().mockResolvedValue({
                data: { items: [{ id: 'city-sanjose', name: 'San José' }], total: 1 }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: 'San José',
                country: 'Uruguay',
                destinationService,
                actor: fakeActor
            });

            // Assert
            expect(result.candidates).toStrictEqual([{ id: 'city-sanjose', name: 'San José' }]);
            expect(result.confident).toBe(false);
        });

        it.each([
            ['Argentina'],
            ['AR'],
            ['ar'],
            [' Argentina '],
            ['República Argentina']
        ])('should stay confident when the scraped country is %s', async (country) => {
            // Arrange
            const searchFn = vi.fn().mockResolvedValue({
                data: { items: [{ id: 'city-sanjose', name: 'San José' }], total: 1 }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: 'San José',
                country,
                destinationService,
                actor: fakeActor
            });

            // Assert
            expect(result.confident).toBe(true);
        });

        it('should never return a destinationId, confident or not', async () => {
            // Arrange
            const searchFn = vi.fn().mockResolvedValue({
                data: { items: [{ id: 'city-colon', name: 'Colón' }], total: 1 }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: 'Colón',
                destinationService,
                actor: fakeActor
            });

            // Assert — SPEC-222 AC-8.2.
            expect(result).not.toHaveProperty('destinationId');
            const keys = Object.keys(result);
            expect(
                keys.every(
                    (k) => k === 'candidates' || k === 'scrapedLocality' || k === 'confident'
                )
            ).toBe(true);
        });
    });
});
