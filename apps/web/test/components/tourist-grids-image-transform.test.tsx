/**
 * @file tourist-grids-image-transform.test.tsx
 * @description HOS-1094 regression: the three tourist-facing card grids (AI search
 * results, recommendations feed, bookmarks) must render the Cloudinary URL through
 * `getMediaUrl` (`card` preset), never the untransformed original.
 */

import { MEDIA_PRESETS } from '@repo/media';
import type { AccommodationPublic } from '@repo/schemas';
import { render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookmarkItem } from '../../src/components/account/BookmarkGrid';
import { BookmarkGrid } from '../../src/components/account/BookmarkGrid';
import { RecommendationsFeed } from '../../src/components/account/RecommendationsFeed.client';
import { ResultCard } from '../../src/components/ai-search/ResultCard';

vi.mock('../../src/lib/i18n', () => ({
    createTranslations: () => ({ t: (key: string, fallback?: string) => fallback ?? key })
}));

const CLD_ORIGINAL = 'https://res.cloudinary.com/demo/image/upload/v123/accommodations/casa.jpg';
const CLD_TRANSFORMED = `https://res.cloudinary.com/demo/image/upload/${MEDIA_PRESETS.card}/v123/accommodations/casa.jpg`;

/** Returns the `src` of the only `<img>` in a markup string. */
function imgSrc(html: string): string | null {
    const match = /<img[^>]*\ssrc="([^"]*)"/.exec(html);
    return match?.[1]?.replaceAll('&amp;', '&') ?? null;
}

describe('HOS-1094 tourist grids transform the card image', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    it('ResultCard (AI search) renders the card-preset URL', () => {
        const item = {
            id: 'a1',
            slug: 'casa',
            name: 'Casa',
            media: { featuredImage: { url: CLD_ORIGINAL } }
        } as unknown as AccommodationPublic;
        const html = renderToStaticMarkup(
            <ResultCard
                item={item}
                locale="es"
                t={((_k: string, f?: string) => f ?? _k) as never}
            />
        );
        expect(imgSrc(html)).toBe(CLD_TRANSFORMED);
    });

    it('RecommendationsFeed renders the card-preset URL', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                data: {
                    items: [
                        {
                            accommodation: {
                                id: 'a1',
                                slug: 'casa',
                                name: 'Casa',
                                media: { featuredImage: { url: CLD_ORIGINAL } }
                            },
                            score: {},
                            totalScore: 1,
                            reason: 'OTHER'
                        }
                    ],
                    isColdStart: false,
                    generatedAt: new Date().toISOString()
                }
            })
        } as Response);
        const { container } = render(
            <RecommendationsFeed
                locale="es"
                apiUrl="http://localhost:3001"
            />
        );
        await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
        expect(container.querySelector('img')?.getAttribute('src')).toBe(CLD_TRANSFORMED);
        expect(screen.queryByText('Sin imagen')).toBeNull();
    });

    it('BookmarkGrid renders the card-preset URL for the enriched entityImage', () => {
        const bookmark: BookmarkItem = {
            id: 'b1',
            entityId: 'a1',
            entityType: 'ACCOMMODATION',
            entityName: 'Casa',
            entitySlug: 'casa',
            entityImage: CLD_ORIGINAL
        } as BookmarkItem;
        const noop = () => undefined;
        const html = renderToStaticMarkup(
            <BookmarkGrid
                bookmarks={[bookmark]}
                total={1}
                page={1}
                totalPages={1}
                removingIds={new Set()}
                locale="es"
                pathSegment="alojamientos"
                cardTypeLabel="Alojamiento"
                removeLabel="x"
                removingLabel="x"
                removeBtnLabel="x"
                noImageLabel="x"
                untitledLabel="x"
                listAriaLabel="x"
                paginationAriaLabel="x"
                prevLabel="x"
                nextLabel="x"
                prevPageLabel="x"
                nextPageLabel="x"
                apiBase="http://localhost:3001"
                notePlaceholder="x"
                noteSaveLabel="x"
                noteCancelLabel="x"
                noteTextareaLabel="x"
                noteEditButtonLabel="x"
                noteSaveErrorMessage="x"
                moveBtnLabel="x"
                moveBtnAriaLabel="x"
                onRemove={noop}
                onPageChange={noop}
                onMove={noop}
                onNoteUpdated={noop}
            />
        );
        expect(imgSrc(html)).toBe(CLD_TRANSFORMED);
    });
});
