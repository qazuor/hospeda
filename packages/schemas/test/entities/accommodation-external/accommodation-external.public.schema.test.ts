import { describe, expect, it } from 'vitest';
import {
    SNIPPETS_TTL_MS,
    buildExternalReputationBlock
} from '../../../src/entities/accommodation-external/accommodation-external.public.schema.js';
import type { ExternalReputationSource } from '../../../src/entities/accommodation-external/accommodation-external.public.schema.js';
import { ExternalPlatformEnum } from '../../../src/enums/external-platform.enum.js';

// ============================================================================
// Test fixtures
// ============================================================================

/** Returns a timestamp within the TTL window (1 hour ago from real now). */
const freshFetchedAt = (): Date => new Date(Date.now() - 60 * 60 * 1000);

/** Returns a timestamp outside the TTL window (8 days ago from real now). */
const staleFetchedAt = (): Date => new Date(Date.now() - (SNIPPETS_TTL_MS + 24 * 60 * 60 * 1000));

const SNIPPET = { author: 'Alice', text: 'Amazing place!', rating: 5 };

function buildSource(overrides?: Partial<ExternalReputationSource>): ExternalReputationSource {
    return {
        platform: ExternalPlatformEnum.GOOGLE,
        url: 'https://maps.google.com/?cid=12345',
        showLink: true,
        showReviews: true,
        verified: true,
        rating: 4.7,
        reviewsCount: 120,
        deepLink: 'https://maps.google.com/?cid=12345#reviews',
        snippets: [SNIPPET],
        snippetsFetchedAt: freshFetchedAt(),
        ...overrides
    };
}

// ============================================================================
// buildExternalReputationBlock — filtering rules
// ============================================================================

describe('buildExternalReputationBlock', () => {
    describe('Rule 1: unverified listings are excluded', () => {
        it('should return empty items when the only listing is unverified', () => {
            // Arrange
            const sources = [buildSource({ verified: false })];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items).toHaveLength(0);
        });

        it('should include only verified listings when mixed', () => {
            // Arrange
            const sources = [
                buildSource({ platform: ExternalPlatformEnum.GOOGLE, verified: true }),
                buildSource({ platform: ExternalPlatformEnum.BOOKING, verified: false })
            ];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items).toHaveLength(1);
            expect(block.items[0]?.platform).toBe(ExternalPlatformEnum.GOOGLE);
        });
    });

    describe('Rule 2: listings with both showLink=false and showReviews=false are excluded', () => {
        it('should exclude fully-hidden listings', () => {
            // Arrange
            const sources = [buildSource({ showLink: false, showReviews: false })];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items).toHaveLength(0);
        });

        it('should include listing when showLink=true even if showReviews=false', () => {
            // Arrange
            const sources = [buildSource({ showLink: true, showReviews: false })];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items).toHaveLength(1);
        });

        it('should include listing when showReviews=true even if showLink=false', () => {
            // Arrange
            const sources = [buildSource({ showLink: false, showReviews: true, snippets: null })];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items).toHaveLength(1);
        });
    });

    describe('Rule 3: url and deepLink are only included when showLink=true', () => {
        it('should include url and deepLink when showLink=true', () => {
            // Arrange
            const sources = [buildSource({ showLink: true })];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items[0]?.url).toBe('https://maps.google.com/?cid=12345');
            expect(block.items[0]?.deepLink).toBe('https://maps.google.com/?cid=12345#reviews');
        });

        it('should strip url and deepLink when showLink=false', () => {
            // Arrange
            const sources = [buildSource({ showLink: false, showReviews: true })];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items[0]?.url).toBeNull();
            expect(block.items[0]?.deepLink).toBeNull();
        });
    });

    describe('Rule 4: snippets filtering (Google-only + TTL + showReviews)', () => {
        it('should include snippets for GOOGLE when showReviews=true and within TTL', () => {
            // Arrange
            const sources = [
                buildSource({
                    platform: ExternalPlatformEnum.GOOGLE,
                    showReviews: true,
                    snippets: [SNIPPET],
                    snippetsFetchedAt: freshFetchedAt()
                })
            ];

            // Act — pass NOW as the reference point via a custom TTL from the future
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items[0]?.snippets).toBeDefined();
            expect(block.items[0]?.snippets).toHaveLength(1);
            expect(block.items[0]?.snippets?.[0]?.author).toBe('Alice');
        });

        it('should strip snippets for GOOGLE when TTL-expired', () => {
            // Arrange
            const sources = [
                buildSource({
                    platform: ExternalPlatformEnum.GOOGLE,
                    showReviews: true,
                    snippets: [SNIPPET],
                    snippetsFetchedAt: staleFetchedAt()
                })
            ];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items[0]?.snippets).toBeNull();
        });

        it('should strip snippets for BOOKING even when showReviews=true and within TTL', () => {
            // Arrange
            const sources = [
                buildSource({
                    platform: ExternalPlatformEnum.BOOKING,
                    showReviews: true,
                    snippets: [SNIPPET],
                    snippetsFetchedAt: freshFetchedAt()
                })
            ];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items[0]?.snippets).toBeNull();
        });

        it('should strip snippets for AIRBNB even when showReviews=true and within TTL', () => {
            // Arrange
            const sources = [
                buildSource({
                    platform: ExternalPlatformEnum.AIRBNB,
                    showReviews: true,
                    snippets: [SNIPPET],
                    snippetsFetchedAt: freshFetchedAt()
                })
            ];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items[0]?.snippets).toBeNull();
        });

        it('should strip snippets for OTHER platform', () => {
            // Arrange
            const sources = [
                buildSource({
                    platform: ExternalPlatformEnum.OTHER,
                    showReviews: true,
                    snippets: [SNIPPET],
                    snippetsFetchedAt: freshFetchedAt()
                })
            ];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items[0]?.snippets).toBeNull();
        });

        it('should strip snippets for GOOGLE when showReviews=false', () => {
            // Arrange
            const sources = [
                buildSource({
                    platform: ExternalPlatformEnum.GOOGLE,
                    showLink: true,
                    showReviews: false,
                    snippets: [SNIPPET],
                    snippetsFetchedAt: freshFetchedAt()
                })
            ];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items[0]?.snippets).toBeNull();
        });

        it('should strip snippets when snippetsFetchedAt is null', () => {
            // Arrange
            const sources = [
                buildSource({
                    platform: ExternalPlatformEnum.GOOGLE,
                    showReviews: true,
                    snippets: [SNIPPET],
                    snippetsFetchedAt: null
                })
            ];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items[0]?.snippets).toBeNull();
        });

        it('should accept a custom TTL of 0 to treat all snippets as expired', () => {
            // Arrange
            const sources = [
                buildSource({
                    platform: ExternalPlatformEnum.GOOGLE,
                    showReviews: true,
                    snippets: [SNIPPET],
                    snippetsFetchedAt: freshFetchedAt()
                })
            ];

            // Act — TTL of 0 means every fetch is immediately stale
            const block = buildExternalReputationBlock(sources, 0);

            // Assert
            expect(block.items[0]?.snippets).toBeNull();
        });
    });

    describe('multiple platforms', () => {
        it('should handle multiple platforms with different showLink/showReviews settings', () => {
            // Arrange
            const sources: ExternalReputationSource[] = [
                buildSource({
                    platform: ExternalPlatformEnum.GOOGLE,
                    showLink: true,
                    showReviews: true,
                    snippetsFetchedAt: freshFetchedAt()
                }),
                buildSource({
                    platform: ExternalPlatformEnum.BOOKING,
                    url: 'https://www.booking.com/hotel/ar/test.html',
                    showLink: true,
                    showReviews: false,
                    deepLink: null,
                    snippets: null,
                    snippetsFetchedAt: null
                }),
                buildSource({
                    platform: ExternalPlatformEnum.AIRBNB,
                    url: 'https://www.airbnb.com/rooms/12345',
                    showLink: false,
                    showReviews: false,
                    verified: true
                })
            ];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert — AIRBNB is hidden (both flags false); GOOGLE and BOOKING are present
            expect(block.items).toHaveLength(2);

            const google = block.items.find((i) => i.platform === ExternalPlatformEnum.GOOGLE);
            const booking = block.items.find((i) => i.platform === ExternalPlatformEnum.BOOKING);

            expect(google?.snippets).toHaveLength(1);
            expect(booking?.snippets).toBeNull();
            expect(booking?.url).toBe('https://www.booking.com/hotel/ar/test.html');
        });

        it('should return empty block when all sources are excluded', () => {
            // Arrange
            const sources: ExternalReputationSource[] = [
                buildSource({ verified: false }),
                buildSource({ showLink: false, showReviews: false })
            ];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items).toHaveLength(0);
        });
    });

    describe('edge cases', () => {
        it('should return empty items for an empty sources array', () => {
            // Arrange / Act
            const block = buildExternalReputationBlock([], SNIPPETS_TTL_MS);
            // Assert
            expect(block.items).toHaveLength(0);
        });

        it('should handle string snippetsFetchedAt (as returned by some DB drivers)', () => {
            // Arrange
            const sources = [
                buildSource({
                    platform: ExternalPlatformEnum.GOOGLE,
                    showReviews: true,
                    snippets: [SNIPPET],
                    snippetsFetchedAt: freshFetchedAt().toISOString()
                })
            ];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert — string date within TTL should still surface snippets
            expect(block.items[0]?.snippets).toHaveLength(1);
        });

        it('should NOT set snippetsTtlExpired when Google item has showReviews=false (L5 regression)', () => {
            // Arrange — owner intentionally disabled reviews; the UI must NOT show the TTL note
            const sources = [
                buildSource({
                    platform: ExternalPlatformEnum.GOOGLE,
                    showLink: true,
                    showReviews: false,
                    snippets: null,
                    snippetsFetchedAt: null
                })
            ];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert — snippetsTtlExpired must be absent/falsy (deliberate opt-out, not TTL)
            expect(block.items).toHaveLength(1);
            expect(block.items[0]?.snippetsTtlExpired).toBeFalsy();
        });

        it('should set snippetsTtlExpired=true when Google item has showReviews=true but TTL expired (L5 regression)', () => {
            // Arrange — owner WANTED reviews but the cached fetch is stale
            const sources = [
                buildSource({
                    platform: ExternalPlatformEnum.GOOGLE,
                    showLink: true,
                    showReviews: true,
                    snippets: [SNIPPET],
                    snippetsFetchedAt: staleFetchedAt() // expired
                })
            ];

            // Act
            const block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);

            // Assert — snippetsTtlExpired must be true so the UI shows the "unavailable" note
            expect(block.items).toHaveLength(1);
            expect(block.items[0]?.snippetsTtlExpired).toBe(true);
            expect(block.items[0]?.snippets).toBeNull();
        });

        it('should skip invalid items and keep valid ones without throwing (M2 regression)', () => {
            // Arrange — one invalid item (rating out of range) + one valid Google item
            const invalidSource: ExternalReputationSource = {
                ...buildSource({ platform: ExternalPlatformEnum.BOOKING }),
                // Override rating to something that will pass buildSource then fail parse via a bad cast.
                // We inject a too-high rating by manipulating the number after building.
                rating: 999 // max allowed is 10 — this should fail ExternalReputationPlatformItemSchema
            };
            const validSource = buildSource({
                platform: ExternalPlatformEnum.GOOGLE,
                showReviews: true,
                snippets: [SNIPPET],
                snippetsFetchedAt: freshFetchedAt()
            });
            const sources = [invalidSource, validSource];

            // Act — must NOT throw even though BOOKING item has invalid rating
            let block: ReturnType<typeof buildExternalReputationBlock>;
            expect(() => {
                block = buildExternalReputationBlock(sources, SNIPPETS_TTL_MS);
            }).not.toThrow();

            // Assert — valid Google item is present; invalid BOOKING item is absent
            expect(block!.items).toHaveLength(1);
            expect(block!.items[0]?.platform).toBe(ExternalPlatformEnum.GOOGLE);
        });

        it('should gracefully handle unknown platform strings (skip the row)', () => {
            // Arrange
            const sources = [
                {
                    ...buildSource(),
                    platform: 'TRIPADVISOR'
                }
            ];

            // Act
            // biome-ignore lint/suspicious/noExplicitAny: intentionally passing invalid data for test
            const block = buildExternalReputationBlock(sources as any, SNIPPETS_TTL_MS);

            // Assert
            expect(block.items).toHaveLength(0);
        });
    });
});
