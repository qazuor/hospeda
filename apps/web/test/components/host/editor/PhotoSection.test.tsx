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
 */

import { PhotoSection } from '@/components/host/editor/PhotoSection.client';
import type { PhotoSectionProps } from '@/components/host/editor/PhotoSection.client';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/components/host/editor/PhotoSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
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
});
