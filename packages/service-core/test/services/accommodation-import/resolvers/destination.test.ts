/**
 * Tests for accommodation-import destination hint resolver (SPEC-222)
 *
 * Verifies that {@link buildDestinationHint}:
 * - Returns candidate destinations from search results.
 * - Returns empty candidates when locality is absent/empty.
 * - Degrades gracefully on service errors.
 * - NEVER auto-selects a destinationId, even on a single exact match.
 */

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
        it('should return all candidates with id and name, and set scrapedLocality', async () => {
            // Arrange
            const searchFn = vi.fn().mockResolvedValue({
                data: {
                    items: [
                        { id: 'dest-uuid-0001', name: 'Concepción del Uruguay' },
                        { id: 'dest-uuid-0002', name: 'Concepción' }
                    ],
                    total: 2
                }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            const result = await buildDestinationHint({
                locality: 'Concepción del Uruguay',
                destinationService,
                actor: fakeActor
            });

            // Assert
            expect(result.scrapedLocality).toBe('Concepción del Uruguay');
            expect(result.candidates).toHaveLength(2);
            expect(result.candidates[0]).toStrictEqual({
                id: 'dest-uuid-0001',
                name: 'Concepción del Uruguay'
            });
            expect(result.candidates[1]).toStrictEqual({
                id: 'dest-uuid-0002',
                name: 'Concepción'
            });
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

        it('should forward country when provided', async () => {
            // Arrange
            const searchFn = vi.fn().mockResolvedValue({
                data: { items: [], total: 0 }
            });
            const destinationService = makeDestinationServiceMock(searchFn);

            // Act
            await buildDestinationHint({
                locality: 'Rosario',
                country: 'AR',
                destinationService,
                actor: fakeActor
            });

            // Assert
            expect(searchFn).toHaveBeenCalledWith(
                fakeActor,
                expect.objectContaining({ country: 'AR' })
            );
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
            expect(result).toStrictEqual({ candidates: [] });
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
            expect(result).toStrictEqual({ candidates: [] });
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
            expect(result).toStrictEqual({ candidates: [] });
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
                candidates: []
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
                candidates: []
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
            expect(keys.every((k) => k === 'candidates' || k === 'scrapedLocality')).toBe(true);
        });
    });
});
