/**
 * Regression suite for H-133 — "with no data, the public listing publishes the
 * reputation block anyway, promising a score it does not show".
 *
 * The measured page (hospeda.com.ar, 2026-08-15) rendered, in this order:
 *   "Reputación en otras plataformas"
 *   "Opiniones de viajeros verificados en los principales sitios de alojamiento"
 *   "Google — Sin datos disponibles"
 *   "Reseñas destacadas, vía Google"
 *   "Las reseñas de texto no están disponibles temporalmente; mostrando solo el puntaje"
 *
 * …with zero star glyphs in the DOM. The block claimed to be showing a score
 * two lines after stating there was no data.
 *
 * These tests cover the predicate that decides whether the section renders. The
 * Astro component itself cannot be rendered under Vitest, which is exactly why
 * the decision was extracted into a plain module instead of being asserted
 * against the component's source text — a source scan cannot tell a declared
 * branch from a taken one.
 */

import type { ExternalReputationPlatformItem } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    hasAggregate,
    hasAnythingToShow,
    hasValidSnippets,
    selectVisibleReputationItems
} from '../../src/lib/external-reputation-visibility';

/**
 * The exact production shape behind H-133: the owner enabled the platform, the
 * refresh reported success, and every data column came back NULL.
 */
function emptyGoogleItem(
    overrides: Partial<ExternalReputationPlatformItem> = {}
): ExternalReputationPlatformItem {
    return {
        platform: 'GOOGLE',
        rating: null,
        reviewsCount: null,
        deepLink: null,
        snippets: null,
        snippetsTtlExpired: false,
        ...overrides
    } as ExternalReputationPlatformItem;
}

describe('H-133 — the reputation block must not publish itself with nothing to show', () => {
    describe('selectVisibleReputationItems', () => {
        it('drops a platform whose every field is empty', () => {
            const visible = selectVisibleReputationItems({ items: [emptyGoogleItem()] });

            expect(visible).toHaveLength(0);
        });

        it('leaves the section with nothing to render when all platforms are empty', () => {
            const visible = selectVisibleReputationItems({
                items: [
                    emptyGoogleItem(),
                    emptyGoogleItem({
                        platform: 'BOOKING'
                    } as Partial<ExternalReputationPlatformItem>),
                    emptyGoogleItem({
                        platform: 'AIRBNB'
                    } as Partial<ExternalReputationPlatformItem>)
                ]
            });

            // An empty result is the component's signal to render nothing at all.
            expect(visible).toHaveLength(0);
        });

        it('keeps a platform that has a rating', () => {
            const visible = selectVisibleReputationItems({
                items: [emptyGoogleItem({ rating: 4.8 })]
            });

            expect(visible).toHaveLength(1);
        });

        it('keeps a platform that has only a review count', () => {
            const visible = selectVisibleReputationItems({
                items: [emptyGoogleItem({ reviewsCount: 41 })]
            });

            expect(visible).toHaveLength(1);
        });

        it('keeps a platform that has only a deep link — "Ver en Google →" is real content', () => {
            const visible = selectVisibleReputationItems({
                items: [emptyGoogleItem({ deepLink: 'https://maps.google.com/?cid=987' })]
            });

            expect(visible).toHaveLength(1);
        });

        it('keeps a platform that has only snippets', () => {
            const visible = selectVisibleReputationItems({
                items: [
                    emptyGoogleItem({
                        snippets: [
                            { author: 'Ana P.', text: 'Hermoso lugar.' }
                        ] as ExternalReputationPlatformItem['snippets']
                    })
                ]
            });

            expect(visible).toHaveLength(1);
        });

        it('drops only the empty platforms, keeping the populated ones', () => {
            const populated = emptyGoogleItem({ rating: 4.8 });
            const visible = selectVisibleReputationItems({
                items: [
                    emptyGoogleItem({
                        platform: 'BOOKING'
                    } as Partial<ExternalReputationPlatformItem>),
                    populated
                ]
            });

            expect(visible).toEqual([populated]);
        });
    });

    describe('hasAggregate — gates the "mostrando solo el puntaje" note', () => {
        it('is false when there is no score, so the note cannot claim one', () => {
            // This is the literal contradiction from the measured page: the TTL
            // note rendered under "Sin datos disponibles".
            expect(hasAggregate({ item: emptyGoogleItem({ snippetsTtlExpired: true }) })).toBe(
                false
            );
        });

        it('is true once there is a rating to actually show', () => {
            expect(
                hasAggregate({ item: emptyGoogleItem({ rating: 4.8, snippetsTtlExpired: true }) })
            ).toBe(true);
        });

        it('is true when only the review count is present', () => {
            expect(hasAggregate({ item: emptyGoogleItem({ reviewsCount: 41 }) })).toBe(true);
        });
    });

    describe('hasValidSnippets', () => {
        it('is false for an empty snippet array', () => {
            expect(
                hasValidSnippets({
                    item: emptyGoogleItem({
                        snippets: [] as ExternalReputationPlatformItem['snippets']
                    })
                })
            ).toBe(false);
        });

        it('is false for a non-Google platform even when snippets are present', () => {
            expect(
                hasValidSnippets({
                    item: emptyGoogleItem({
                        platform: 'BOOKING',
                        snippets: [
                            { author: 'X', text: 'Y' }
                        ] as ExternalReputationPlatformItem['snippets']
                    } as Partial<ExternalReputationPlatformItem>)
                })
            ).toBe(false);
        });
    });

    describe('hasAnythingToShow', () => {
        it('is false for the exact production row that produced H-133', () => {
            expect(hasAnythingToShow({ item: emptyGoogleItem() })).toBe(false);
        });
    });
});
