/**
 * @file image-gallery.test.tsx
 * @description Tests for ImageGallery.client.tsx component.
 *
 * Covers image rendering, thumbnail selection and state, fullscreen lightbox
 * open/close flow, navigation arrows inside the lightbox, image counter,
 * keyboard navigation (Escape, ArrowLeft, ArrowRight), and accessibility.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImageGallery } from '../../../src/components/shared/ImageGallery.client';
import type { GalleryImage } from '../../../src/components/shared/ImageGallery.client';

vi.mock('../../../src/hooks/useTranslation', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        tPlural: (key: string, _n: number, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@repo/icons', () => ({
    CloseIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="close"
        />
    ),
    NextIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="next"
        />
    ),
    PreviousIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="previous"
        />
    ),
    ChevronLeftIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="chevron-left"
        />
    ),
    ChevronRightIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="chevron-right"
        />
    )
}));

const mockImages: ReadonlyArray<GalleryImage> = [
    { src: '/image1.jpg', alt: 'Image 1' },
    { src: '/image2.jpg', alt: 'Image 2' },
    { src: '/image3.jpg', alt: 'Image 3' }
];

const singleImage: ReadonlyArray<GalleryImage> = [{ src: '/single.jpg', alt: 'Single Image' }];

describe('ImageGallery.client.tsx', () => {
    describe('Props', () => {
        it('should render the gallery container when images are provided', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            expect(screen.getByTestId('image-gallery')).toBeInTheDocument();
        });

        it('should apply className prop to the root element', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    className="custom-class"
                    locale="en"
                />
            );
            expect(screen.getByTestId('image-gallery')).toHaveClass('custom-class');
        });

        it('should show fallback text for empty images array', () => {
            render(
                <ImageGallery
                    images={[]}
                    locale="en"
                />
            );
            expect(screen.getByText('No images available')).toBeInTheDocument();
        });
    });

    describe('Main image rendering', () => {
        it('should render the first image as the main image by default', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            const mainImage = screen.getByTestId('main-image');
            expect(mainImage).toHaveAttribute('src', mockImages[0]!.src);
            expect(mainImage).toHaveAttribute('alt', mockImages[0]!.alt);
        });

        it('should not render the lightbox overlay by default', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument();
        });
    });

    describe('Thumbnail strip', () => {
        it('should render the thumbnail strip for multiple images', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            expect(screen.getByTestId('thumbnail-strip')).toBeInTheDocument();
        });

        it('should not render the thumbnail strip for a single image', () => {
            render(
                <ImageGallery
                    images={singleImage}
                    locale="en"
                />
            );
            expect(screen.queryByTestId('thumbnail-strip')).not.toBeInTheDocument();
        });

        it('should render the correct number of thumbnail buttons', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            const thumbnails = screen.getAllByTestId(/^thumbnail-\d+$/);
            expect(thumbnails).toHaveLength(mockImages.length);
        });

        it('should render each thumbnail with the correct image src and alt', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            for (const [index, image] of mockImages.entries()) {
                const thumbnail = screen.getByTestId(`thumbnail-${index}`);
                const img = thumbnail.querySelector('img');
                expect(img).toHaveAttribute('src', image.src);
                expect(img).toHaveAttribute('alt', image.alt);
            }
        });

        it('should mark the first thumbnail as pressed by default', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            expect(screen.getByTestId('thumbnail-0')).toHaveAttribute('aria-pressed', 'true');
        });

        it('should mark non-selected thumbnails as not pressed', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            expect(screen.getByTestId('thumbnail-1')).toHaveAttribute('aria-pressed', 'false');
        });
    });

    describe('Thumbnail selection', () => {
        it('should change the main image when a thumbnail is clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('thumbnail-1'));
            expect(screen.getByTestId('main-image')).toHaveAttribute('src', mockImages[1]!.src);
        });

        it('should apply border-primary active style to the selected thumbnail', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            expect(screen.getByTestId('thumbnail-0').className).toContain('border-primary');
        });

        it('should update aria-pressed when a new thumbnail is selected', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('thumbnail-2'));
            expect(screen.getByTestId('thumbnail-2')).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByTestId('thumbnail-0')).toHaveAttribute('aria-pressed', 'false');
        });
    });

    describe('Lightbox - open and close', () => {
        it('should open the lightbox when the main image button is clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            expect(screen.getByTestId('lightbox')).toBeInTheDocument();
        });

        it('should display the current image inside the lightbox', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            const lightboxImage = screen.getByTestId('lightbox-image');
            expect(lightboxImage).toHaveAttribute('src', mockImages[0]!.src);
            expect(lightboxImage).toHaveAttribute('alt', mockImages[0]!.alt);
        });

        it('should render the close button inside the lightbox', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            expect(screen.getByTestId('close-button')).toBeInTheDocument();
        });

        it('should close the lightbox when the close button is clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            fireEvent.click(screen.getByTestId('close-button'));
            expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument();
        });

        it('should close the lightbox when the overlay background is clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            fireEvent.click(screen.getByTestId('lightbox'));
            expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument();
        });

        it('should not close the lightbox when the inner image is clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            fireEvent.click(screen.getByTestId('lightbox-image'));
            expect(screen.getByTestId('lightbox')).toBeInTheDocument();
        });
    });

    describe('Lightbox - image counter', () => {
        it('should display the image counter in "N / total" format', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            expect(screen.getByTestId('image-counter')).toHaveTextContent('1 / 3');
        });

        it('should update the counter after navigating to the next image', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            fireEvent.click(screen.getByTestId('next-button'));
            expect(screen.getByTestId('image-counter')).toHaveTextContent('2 / 3');
        });

        it('should show counter for a single image as "1 / 1"', () => {
            render(
                <ImageGallery
                    images={singleImage}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            expect(screen.getByTestId('image-counter')).toHaveTextContent('1 / 1');
        });
    });

    describe('Lightbox - navigation arrows', () => {
        it('should render prev and next buttons for multiple images in lightbox', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            expect(screen.getByTestId('prev-button')).toBeInTheDocument();
            expect(screen.getByTestId('next-button')).toBeInTheDocument();
        });

        it('should not render nav buttons for a single image in lightbox', () => {
            render(
                <ImageGallery
                    images={singleImage}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            expect(screen.queryByTestId('prev-button')).not.toBeInTheDocument();
            expect(screen.queryByTestId('next-button')).not.toBeInTheDocument();
        });

        it('should navigate to the next image when next button is clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            fireEvent.click(screen.getByTestId('next-button'));
            expect(screen.getByTestId('lightbox-image')).toHaveAttribute('src', mockImages[1]!.src);
        });

        it('should navigate to the previous image when prev button is clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            fireEvent.click(screen.getByTestId('next-button'));
            fireEvent.click(screen.getByTestId('prev-button'));
            expect(screen.getByTestId('lightbox-image')).toHaveAttribute('src', mockImages[0]!.src);
        });

        it('should wrap from last to first image when next is clicked on last image', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            fireEvent.click(screen.getByTestId('next-button'));
            fireEvent.click(screen.getByTestId('next-button'));
            fireEvent.click(screen.getByTestId('next-button'));
            expect(screen.getByTestId('lightbox-image')).toHaveAttribute('src', mockImages[0]!.src);
        });

        it('should wrap from first to last image when prev is clicked on first image', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            fireEvent.click(screen.getByTestId('prev-button'));
            expect(screen.getByTestId('lightbox-image')).toHaveAttribute('src', mockImages[2]!.src);
        });
    });

    describe('Keyboard navigation', () => {
        it('should close the lightbox when Escape is pressed', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            fireEvent.keyDown(window, { key: 'Escape' });
            expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument();
        });

        it('should navigate to next image when ArrowRight is pressed', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            fireEvent.keyDown(window, { key: 'ArrowRight' });
            expect(screen.getByTestId('lightbox-image')).toHaveAttribute('src', mockImages[1]!.src);
        });

        it('should navigate to previous image when ArrowLeft is pressed', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            fireEvent.keyDown(window, { key: 'ArrowRight' });
            fireEvent.keyDown(window, { key: 'ArrowLeft' });
            expect(screen.getByTestId('lightbox-image')).toHaveAttribute('src', mockImages[0]!.src);
        });

        it('should not respond to keyboard events when lightbox is closed', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.keyDown(window, { key: 'ArrowRight' });
            // Main image should still show first image since lightbox was never opened
            expect(screen.getByTestId('main-image')).toHaveAttribute('src', mockImages[0]!.src);
        });
    });

    describe('Accessibility', () => {
        it('should have type="button" on the main image open button', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            const btn = screen.getByTestId('main-image').parentElement as HTMLButtonElement;
            expect(btn).toHaveAttribute('type', 'button');
        });

        it('should have aria-label on thumbnail buttons', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            expect(screen.getByTestId('thumbnail-0')).toHaveAttribute('aria-label', 'View Image 1');
        });

        it('should have focus:outline styles on the main image button', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            const btn = screen.getByTestId('main-image').parentElement as HTMLElement;
            expect(btn.className).toContain('focus:outline');
        });

        it('should have type="button" on thumbnail buttons', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            expect(screen.getByTestId('thumbnail-0')).toHaveAttribute('type', 'button');
        });

        it('should have type="button" on lightbox close button', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('main-image'));
            expect(screen.getByTestId('close-button')).toHaveAttribute('type', 'button');
        });
    });

    describe('Edge cases', () => {
        it('should preserve the selected thumbnail image when opening the lightbox', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('thumbnail-1'));
            fireEvent.click(screen.getByTestId('main-image'));
            expect(screen.getByTestId('lightbox-image')).toHaveAttribute('src', mockImages[1]!.src);
        });

        it('should maintain selected image after closing and reopening lightbox', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByTestId('thumbnail-2'));
            fireEvent.click(screen.getByTestId('main-image'));
            fireEvent.click(screen.getByTestId('close-button'));
            fireEvent.click(screen.getByTestId('main-image'));
            expect(screen.getByTestId('lightbox-image')).toHaveAttribute('src', mockImages[2]!.src);
        });
    });
});
