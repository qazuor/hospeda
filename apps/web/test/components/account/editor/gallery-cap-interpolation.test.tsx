/**
 * @file gallery-cap-interpolation.test.tsx
 * @description Regression test for HOS-1934: the media editors rendered the
 * literal `{{cap}}` because they passed the gallery cap only as the plural
 * `count`, while the locale strings interpolate `{{cap}}`.
 *
 * Unlike the sibling suites this one does NOT mock `@/lib/i18n`: the bug lives
 * in the contract between the call site and the real locale strings, which a
 * key-echoing mock cannot see. The shared test setup seeds the real catalog.
 *
 * @module test/components/account/editor/gallery-cap-interpolation
 */

import { getGalleryCap } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentMediaSection } from '../../../../src/components/account/editor/ContentMediaSection.client';
import { MediaSection } from '../../../../src/components/listing/editor/MediaSection.client';

const { mockListContent, mockListListing } = vi.hoisted(() => ({
    mockListContent: vi.fn(),
    mockListListing: vi.fn()
}));

vi.mock('../../../../src/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));
vi.mock('../../../../src/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    contentMediaApi: {
        listMedia: mockListContent,
        addMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn()
    },
    listingMediaApi: {
        listMedia: mockListListing,
        addMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn()
    },
    protectedMediaApi: { deleteMedia: vi.fn() }
}));
vi.mock('../../../../src/store/toast-store', () => ({ addToast: vi.fn() }));

const fullGalleryOf = (cap: number) =>
    Array.from({ length: cap }, (_, i) => ({
        id: `g-${i}`,
        url: `https://cdn.example.com/g${i}.jpg`,
        publicId: `gallery/g${i}`,
        isFeatured: false,
        sortOrder: i + 1,
        state: 'visible' as const,
        moderationState: 'APPROVED'
    }));

const listOk = (rows: ReadonlyArray<unknown>) =>
    Promise.resolve({ ok: true as const, data: { media: rows } });

const galleryInput = (): HTMLInputElement =>
    document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;

describe('gallery cap interpolation (HOS-1934)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        ['post' as const],
        ['event' as const]
    ])('shows the %s gallery cap in the upload hint, not the raw placeholder', async (entity) => {
        // Arrange
        const cap = getGalleryCap(entity);
        mockListContent.mockReturnValue(listOk([]));

        // Act
        render(
            <ContentMediaSection
                locale="es"
                entity={entity}
                entityId="entity-uuid"
            />
        );
        await waitFor(() => expect(mockListContent).toHaveBeenCalled());

        // Assert
        expect(
            screen.getByText(new RegExp(`Hasta ${cap} fotos en la galería`))
        ).toBeInTheDocument();
        expect(document.body.textContent).not.toContain('{{');
    });

    it('interpolates the cap in the cap-reached error of the post/event editor', async () => {
        // Arrange
        const cap = getGalleryCap('post');
        mockListContent.mockReturnValue(listOk(fullGalleryOf(cap)));
        render(
            <ContentMediaSection
                locale="es"
                entity="post"
                entityId="entity-uuid"
            />
        );
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(cap));

        // Act
        fireEvent.change(galleryInput(), {
            target: { files: [new File(['a'], 'a.jpg', { type: 'image/jpeg' })] }
        });

        // Assert
        expect(
            await screen.findByText(`Límite de galería alcanzado (máx. ${cap} fotos)`)
        ).toBeInTheDocument();
    });

    it('interpolates the cap in the cap-reached error of the listing editor', async () => {
        // Arrange
        const cap = getGalleryCap('venue');
        mockListListing.mockReturnValue(listOk(fullGalleryOf(cap)));
        render(
            <MediaSection
                locale="es"
                vertical="venue"
                listingId="listing-uuid"
            />
        );
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(cap));

        // Act
        fireEvent.change(galleryInput(), {
            target: { files: [new File(['a'], 'a.jpg', { type: 'image/jpeg' })] }
        });

        // Assert
        expect(
            await screen.findByText(`Límite de galería alcanzado (máx. ${cap} fotos)`)
        ).toBeInTheDocument();
    });
});
