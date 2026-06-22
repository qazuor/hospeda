/**
 * @file ImageGallery.test.tsx
 * @description Unit tests for the ImageGallery React island.
 * Covers: both variants render correctly, lightbox open/close, keyboard navigation.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GalleryImage } from '../../src/components/ImageGallery.client';
import { ImageGallery } from '../../src/components/ImageGallery.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string, params?: Record<string, unknown>) => {
            if (params && fallback) {
                return Object.entries(params).reduce(
                    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
                    fallback
                );
            }
            return fallback ?? _key;
        }
    })
}));

vi.mock('../../src/components/ImageGallery.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('@repo/icons', () => ({
    ChevronLeftIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="chevron-left"
            width={size}
        />
    ),
    ChevronRightIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="chevron-right"
            width={size}
        />
    ),
    CloseIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="close-icon"
            width={size}
        />
    ),
    FullscreenIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="fullscreen-icon"
            width={size}
        />
    )
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const IMAGES: GalleryImage[] = [
    { url: '/img1.jpg', alt: 'Room 1', caption: 'Suite principal' },
    { url: '/img2.jpg', alt: 'Room 2', caption: 'Baño' },
    { url: '/img3.jpg', alt: 'Room 3', caption: 'Cocina' },
    { url: '/img4.jpg', alt: 'Room 4', caption: 'Jardín' }
];

const SINGLE_IMAGE: GalleryImage[] = [{ url: '/single.jpg', alt: 'Single view' }];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ImageGallery', () => {
    describe('Empty state', () => {
        it('renders nothing when images array is empty', () => {
            const { container } = render(
                <ImageGallery
                    images={[]}
                    locale="es"
                />
            );
            expect(container.firstChild).toBeNull();
        });
    });

    describe('variant="detail" (default)', () => {
        it('renders the featured image', () => {
            render(
                <ImageGallery
                    images={IMAGES}
                    locale="es"
                    variant="detail"
                />
            );
            const imgs = screen.getAllByRole('img');
            expect(imgs[0]).toHaveAttribute('src', '/img1.jpg');
            expect(imgs[0]).toHaveAttribute('alt', 'Room 1');
        });

        it('renders thumbnail images', () => {
            render(
                <ImageGallery
                    images={IMAGES}
                    locale="es"
                    variant="detail"
                />
            );
            const imgs = screen.getAllByRole('img');
            // First img is featured, next 3 are thumbs
            expect(imgs.length).toBeGreaterThanOrEqual(4);
        });

        it('renders the featured image as an eager LCP candidate with explicit dimensions and high fetch priority (SPEC-157 REQ-3)', () => {
            render(
                <ImageGallery
                    images={IMAGES}
                    locale="es"
                    variant="detail"
                />
            );
            const featured = screen.getAllByRole('img')[0];
            // The featured image is the LCP candidate on the accommodation detail
            // page: it must be eagerly fetched at high priority and carry explicit
            // dimensions so the browser reserves layout (no CLS) and prioritises it.
            expect(featured).toHaveAttribute('fetchpriority', 'high');
            expect(featured).toHaveAttribute('loading', 'eager');
            expect(Number(featured?.getAttribute('width'))).toBeGreaterThan(0);
            expect(Number(featured?.getAttribute('height'))).toBeGreaterThan(0);
        });

        it('keeps thumbnails lazily loaded (only the featured image is eager)', () => {
            render(
                <ImageGallery
                    images={IMAGES}
                    locale="es"
                    variant="detail"
                />
            );
            const imgs = screen.getAllByRole('img');
            // imgs[0] is the featured image; the rest are thumbnails.
            for (const thumb of imgs.slice(1)) {
                expect(thumb).toHaveAttribute('loading', 'lazy');
            }
        });

        it('renders the fullscreen icon on the featured image button', () => {
            render(
                <ImageGallery
                    images={IMAGES}
                    locale="es"
                    variant="detail"
                />
            );
            expect(screen.getAllByTestId('fullscreen-icon').length).toBeGreaterThan(0);
        });

        it('opens the lightbox when the featured image button is clicked', () => {
            render(
                <ImageGallery
                    images={IMAGES}
                    locale="es"
                    variant="detail"
                />
            );

            // The featured button is the first button
            const [featuredBtn] = screen.getAllByRole('button', {
                name: /pantalla completa/i
            });
            fireEvent.click(featuredBtn as HTMLElement);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('shows "1 / 4" counter in lightbox after opening first image', () => {
            render(
                <ImageGallery
                    images={IMAGES}
                    locale="es"
                    variant="detail"
                />
            );
            const [featuredBtn] = screen.getAllByRole('button', {
                name: /pantalla completa/i
            });
            fireEvent.click(featuredBtn as HTMLElement);

            expect(screen.getByText('1 / 4')).toBeInTheDocument();
        });

        it('does not render prev/next buttons for a single image', () => {
            render(
                <ImageGallery
                    images={SINGLE_IMAGE}
                    locale="es"
                    variant="detail"
                />
            );
            const [featuredBtn] = screen.getAllByRole('button', {
                name: /pantalla completa/i
            });
            fireEvent.click(featuredBtn as HTMLElement);

            expect(screen.queryByTestId('chevron-left')).not.toBeInTheDocument();
            expect(screen.queryByTestId('chevron-right')).not.toBeInTheDocument();
        });
    });

    describe('variant="cover-plus-grid"', () => {
        it('renders the cover image', () => {
            render(
                <ImageGallery
                    images={IMAGES}
                    locale="es"
                    variant="cover-plus-grid"
                />
            );
            const imgs = screen.getAllByRole('img');
            expect(imgs[0]).toHaveAttribute('src', '/img1.jpg');
        });

        it('renders additional images in the inline grid', () => {
            render(
                <ImageGallery
                    images={IMAGES}
                    locale="es"
                    variant="cover-plus-grid"
                />
            );
            const imgs = screen.getAllByRole('img');
            // Cover + 3 grid items
            expect(imgs.length).toBe(4);
        });

        it('opens lightbox on cover click', () => {
            render(
                <ImageGallery
                    images={IMAGES}
                    locale="es"
                    variant="cover-plus-grid"
                />
            );
            const [coverBtn] = screen.getAllByRole('button', {
                name: /pantalla completa/i
            });
            fireEvent.click(coverBtn as HTMLElement);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    describe('Lightbox interactions', () => {
        function openLightbox() {
            render(
                <ImageGallery
                    images={IMAGES}
                    locale="es"
                    variant="detail"
                />
            );
            const [featuredBtn] = screen.getAllByRole('button', {
                name: /pantalla completa/i
            });
            fireEvent.click(featuredBtn as HTMLElement);
        }

        it('renders the lightbox dialog', () => {
            openLightbox();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('closes the lightbox when the close button is clicked', () => {
            openLightbox();
            const closeBtn = screen.getByRole('button', { name: /cerrar visor/i });
            fireEvent.click(closeBtn);
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('closes the lightbox when Escape is pressed', () => {
            openLightbox();
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            fireEvent.keyDown(document, { key: 'Escape' });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('navigates to the next image when the right arrow button is clicked', () => {
            openLightbox();
            expect(screen.getByText('1 / 4')).toBeInTheDocument();

            const nextBtn = screen.getByRole('button', { name: /imagen siguiente/i });
            fireEvent.click(nextBtn);

            expect(screen.getByText('2 / 4')).toBeInTheDocument();
        });

        it('navigates to the previous image when the left arrow button is clicked', () => {
            openLightbox();
            // Go to image 2 first
            const nextBtn = screen.getByRole('button', { name: /imagen siguiente/i });
            fireEvent.click(nextBtn);
            expect(screen.getByText('2 / 4')).toBeInTheDocument();

            // Go back to image 1
            const prevBtn = screen.getByRole('button', { name: /imagen anterior/i });
            fireEvent.click(prevBtn);
            expect(screen.getByText('1 / 4')).toBeInTheDocument();
        });

        it('navigates using ArrowRight keyboard event', () => {
            openLightbox();
            expect(screen.getByText('1 / 4')).toBeInTheDocument();

            fireEvent.keyDown(document, { key: 'ArrowRight' });
            expect(screen.getByText('2 / 4')).toBeInTheDocument();
        });

        it('navigates using ArrowLeft keyboard event', () => {
            openLightbox();
            fireEvent.keyDown(document, { key: 'ArrowRight' });
            expect(screen.getByText('2 / 4')).toBeInTheDocument();

            fireEvent.keyDown(document, { key: 'ArrowLeft' });
            expect(screen.getByText('1 / 4')).toBeInTheDocument();
        });

        it('wraps from last image to first on ArrowRight', () => {
            openLightbox();
            // Jump to last image (index 3 = 4/4)
            fireEvent.keyDown(document, { key: 'ArrowRight' });
            fireEvent.keyDown(document, { key: 'ArrowRight' });
            fireEvent.keyDown(document, { key: 'ArrowRight' });
            expect(screen.getByText('4 / 4')).toBeInTheDocument();

            // One more → wraps to first
            fireEvent.keyDown(document, { key: 'ArrowRight' });
            expect(screen.getByText('1 / 4')).toBeInTheDocument();
        });

        it('renders a thumbnail strip in the lightbox', () => {
            openLightbox();
            const dialog = screen.getByRole('dialog');
            // Thumbnail buttons are the ones in the strip (role=listitem)
            const thumbItems = within(dialog).getAllByRole('listitem');
            expect(thumbItems.length).toBe(IMAGES.length);
        });

        it('navigates to a specific image via thumbnail click', () => {
            openLightbox();
            expect(screen.getByText('1 / 4')).toBeInTheDocument();

            const dialog = screen.getByRole('dialog');
            const thumbItems = within(dialog).getAllByRole('listitem');
            // Click the button inside the 3rd thumbnail (index 2)
            const thirdThumbBtn = thumbItems[2]?.querySelector('button');
            expect(thirdThumbBtn).toBeDefined();
            fireEvent.click(thirdThumbBtn as HTMLElement);
            expect(screen.getByText('3 / 4')).toBeInTheDocument();
        });

        it('renders the caption in the lightbox', () => {
            openLightbox();
            // Caption of the first image
            expect(screen.getByText('Suite principal')).toBeInTheDocument();
        });

        it('displays correct image src in lightbox', () => {
            openLightbox();
            // The main lightbox image should be the featured image src
            const dialog = screen.getByRole('dialog');
            const mainImg = within(dialog)
                .getAllByRole('img')
                .find(
                    (img) =>
                        img.classList.contains('lightboxImg') ||
                        img.getAttribute('src') === '/img1.jpg'
                );
            expect(mainImg).toBeDefined();
        });

        it('closes when clicking the overlay (outside the figure)', () => {
            openLightbox();
            const dialog = screen.getByRole('dialog');
            // The shared Dialog component wraps the panel in a sibling overlay
            // div (role="presentation"). Clicking that overlay closes the modal.
            const overlay = dialog.parentElement;
            expect(overlay).not.toBeNull();
            fireEvent.click(overlay as HTMLElement);
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        // ── T-015: lightbox fade class (SPEC-228) ────────────────────────────

        it('T-015: lightbox image has the lightboxImgFade class for fade transition', () => {
            openLightbox();
            const dialog = screen.getByRole('dialog');
            // Find the main lightbox image (not thumbnails)
            const allImgs = within(dialog).getAllByRole('img');
            // The main lightbox image is identified by having the lightboxImg class
            // (and the new lightboxImgFade class added in T-015)
            const mainImg = allImgs.find(
                (img) =>
                    img.className.includes('lightboxImg') || img.getAttribute('src') === '/img1.jpg'
            );
            expect(mainImg).toBeDefined();
            // The fade class should be present on the lightbox image
            expect(mainImg?.className).toContain('lightboxImgFade');
        });

        it('T-015: lightboxImgFade class is re-applied when navigating to next image', () => {
            openLightbox();
            const dialog = screen.getByRole('dialog');

            // Navigate to next image
            const nextBtn = screen.getByRole('button', { name: /imagen siguiente/i });
            fireEvent.click(nextBtn);

            // The image element should still have the fade class (React remounts with key)
            const allImgs = within(dialog).getAllByRole('img');
            const mainImg = allImgs.find(
                (img) =>
                    img.className.includes('lightboxImg') || img.getAttribute('src') === '/img2.jpg'
            );
            expect(mainImg).toBeDefined();
            expect(mainImg?.className).toContain('lightboxImgFade');
        });
    });
});
