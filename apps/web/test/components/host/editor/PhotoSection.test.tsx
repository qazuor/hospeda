/**
 * @file PhotoSection.test.tsx
 * @description Tests for the PhotoSection component.
 *
 * Covers:
 * - Renders featured image when provided
 * - Renders gallery images when provided
 * - Shows upload area when no featured image
 * - Shows add button in gallery
 * - Remove button removes featured image
 * - Remove button removes gallery image by index
 * - Fix B (SPEC-208): gallery cap enforcement — hides add button and shows
 *   cap message when gallery.length >= ACCOMMODATION_GALLERY_CAP (50)
 * - Fix A (SPEC-208): calls protectedMediaApi.deleteMedia on image remove
 */

import { PhotoSection } from '@/components/host/editor/PhotoSection.client';
import type { PhotoSectionProps } from '@/components/host/editor/PhotoSection.client';
import { ENTITY_GALLERY_CAPS } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockDeleteMedia } = vi.hoisted(() => ({
    mockDeleteMedia: vi.fn().mockResolvedValue({ ok: true, data: { deleted: true } })
}));

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/components/host/editor/PhotoSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    protectedMediaApi: {
        deleteMedia: mockDeleteMedia
    }
}));

vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_FEATURED_IMAGE = {
    url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/prod/accommodations/abc/featured',
    publicId: 'hospeda/prod/accommodations/abc/featured',
    width: 1920,
    height: 1080
};

const MOCK_GALLERY_IMAGES = [
    {
        url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/prod/accommodations/abc/gallery/img1',
        publicId: 'hospeda/prod/accommodations/abc/gallery/img1',
        width: 1200,
        height: 900
    },
    {
        url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/prod/accommodations/abc/gallery/img2',
        publicId: 'hospeda/prod/accommodations/abc/gallery/img2',
        width: 1200,
        height: 900
    }
];

const defaultProps: PhotoSectionProps = {
    locale: 'es',
    accommodationId: '550e8400-e29b-41d4-a716-446655440000',
    data: { featuredImage: null, gallery: [] },
    onFeaturedImageChange: vi.fn(),
    onGalleryChange: vi.fn()
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PhotoSection', () => {
    describe('featured image', () => {
        it('should show upload area when no featured image', () => {
            render(<PhotoSection {...defaultProps} />);
            expect(
                screen.getByText('Arrastrá una imagen o hacé clic para seleccionar')
            ).toBeInTheDocument();
        });

        it('should show featured image when provided', () => {
            render(
                <PhotoSection
                    {...defaultProps}
                    data={{ ...defaultProps.data, featuredImage: MOCK_FEATURED_IMAGE }}
                />
            );
            const img = screen.getByAltText('Imagen principal');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', MOCK_FEATURED_IMAGE.url);
        });

        it('should call onFeaturedImageChange with null when remove is clicked', () => {
            const onFeaturedImageChange = vi.fn();
            render(
                <PhotoSection
                    {...defaultProps}
                    data={{ ...defaultProps.data, featuredImage: MOCK_FEATURED_IMAGE }}
                    onFeaturedImageChange={onFeaturedImageChange}
                />
            );
            fireEvent.click(screen.getByLabelText('Eliminar'));
            expect(onFeaturedImageChange).toHaveBeenCalledWith(null);
        });
    });

    describe('gallery', () => {
        it('should render gallery images', () => {
            render(
                <PhotoSection
                    {...defaultProps}
                    data={{ ...defaultProps.data, gallery: MOCK_GALLERY_IMAGES }}
                />
            );
            const images = screen.getAllByRole('img');
            // 2 gallery images
            expect(images).toHaveLength(2);
        });

        it('should show add button in gallery', () => {
            render(<PhotoSection {...defaultProps} />);
            expect(screen.getByText('+')).toBeInTheDocument();
        });

        it('should call onGalleryChange without the removed image', () => {
            const onGalleryChange = vi.fn();
            render(
                <PhotoSection
                    {...defaultProps}
                    data={{ ...defaultProps.data, gallery: MOCK_GALLERY_IMAGES }}
                    onGalleryChange={onGalleryChange}
                />
            );
            // Click remove on the first gallery image
            const removeButtons = screen.getAllByLabelText('Eliminar');
            // First remove button is for featured (if present), but we have no featured
            // So both are gallery remove buttons
            fireEvent.click(removeButtons[0]);
            expect(onGalleryChange).toHaveBeenCalledWith([MOCK_GALLERY_IMAGES[1]]);
        });
    });

    describe('section header', () => {
        it('should render section title', () => {
            render(<PhotoSection {...defaultProps} />);
            expect(screen.getByText('Fotos')).toBeInTheDocument();
        });

        it('should render section description', () => {
            render(<PhotoSection {...defaultProps} />);
            expect(
                screen.getByText('Subí fotos de tu propiedad para atraer más huéspedes')
            ).toBeInTheDocument();
        });
    });

    // ── Fix B (SPEC-208): gallery cap enforcement ──────────────────────────

    describe('gallery cap enforcement (Fix B / SPEC-208)', () => {
        const GALLERY_CAP = ENTITY_GALLERY_CAPS.accommodation; // 50

        const buildFullGallery = () =>
            Array.from({ length: GALLERY_CAP }, (_, i) => ({
                url: `https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/prod/accommodations/abc/gallery/img${i}`,
                publicId: `hospeda/prod/accommodations/abc/gallery/img${i}`,
                width: 1200,
                height: 900
            }));

        it('should hide the add (+) button when gallery is at the cap', () => {
            render(
                <PhotoSection
                    {...defaultProps}
                    data={{ ...defaultProps.data, gallery: buildFullGallery() }}
                />
            );
            expect(screen.queryByText('+')).not.toBeInTheDocument();
        });

        it('should show the add (+) button when gallery is below the cap', () => {
            render(
                <PhotoSection
                    {...defaultProps}
                    data={{
                        ...defaultProps.data,
                        gallery: buildFullGallery().slice(0, GALLERY_CAP - 1)
                    }}
                />
            );
            expect(screen.getByText('+')).toBeInTheDocument();
        });

        it('should display a gallery-full message when at the cap', () => {
            render(
                <PhotoSection
                    {...defaultProps}
                    data={{ ...defaultProps.data, gallery: buildFullGallery() }}
                />
            );
            // The cap message renders in the gallery section (falls back to raw key since t() returns fallback)
            expect(
                screen.getByText((content) => content.includes('Límite de galería alcanzado'))
            ).toBeInTheDocument();
        });

        it('should not show a gallery-full message when below the cap', () => {
            render(
                <PhotoSection
                    {...defaultProps}
                    data={{ ...defaultProps.data, gallery: [] }}
                />
            );
            expect(
                screen.queryByText((content) => content.includes('Límite de galería alcanzado'))
            ).not.toBeInTheDocument();
        });
    });

    // ── Fix A (SPEC-208): deleteMedia called on image remove ───────────────

    describe('deleteMedia on remove (Fix A / SPEC-208)', () => {
        it('should call deleteMedia with the publicId when featured image is removed', () => {
            mockDeleteMedia.mockClear();
            const onFeaturedImageChange = vi.fn();
            render(
                <PhotoSection
                    {...defaultProps}
                    data={{ ...defaultProps.data, featuredImage: MOCK_FEATURED_IMAGE }}
                    onFeaturedImageChange={onFeaturedImageChange}
                />
            );
            fireEvent.click(screen.getByLabelText('Eliminar'));
            // onFeaturedImageChange should be called with null immediately
            expect(onFeaturedImageChange).toHaveBeenCalledWith(null);
            // deleteMedia should be called best-effort with the publicId
            expect(mockDeleteMedia).toHaveBeenCalledWith({
                publicId: MOCK_FEATURED_IMAGE.publicId
            });
        });

        it('should call deleteMedia with the publicId when a gallery image is removed', () => {
            mockDeleteMedia.mockClear();
            const onGalleryChange = vi.fn();
            render(
                <PhotoSection
                    {...defaultProps}
                    data={{ ...defaultProps.data, gallery: MOCK_GALLERY_IMAGES }}
                    onGalleryChange={onGalleryChange}
                />
            );
            const removeButtons = screen.getAllByLabelText('Eliminar');
            fireEvent.click(removeButtons[0]);
            // State update emitted
            expect(onGalleryChange).toHaveBeenCalledWith([MOCK_GALLERY_IMAGES[1]]);
            // Best-effort delete called with the removed image's publicId
            expect(mockDeleteMedia).toHaveBeenCalledWith({
                publicId: MOCK_GALLERY_IMAGES[0].publicId
            });
        });
    });
});
