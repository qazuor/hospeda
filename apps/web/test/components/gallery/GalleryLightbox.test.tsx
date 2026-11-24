/**
 * @file GalleryLightbox.test.tsx
 * @description The lightbox opens cheaply (owner smoke, HOS-2520): it shows the
 * photo the page already painted while the full-size image loads, and it mounts
 * the thumbnail strip only after its first paint.
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GalleryLightbox } from '@/components/gallery/GalleryLightbox';
import { buildLightboxUrl } from '@/components/gallery/gallery-image-sources';
import { ImageGallery } from '@/components/ImageGallery.client';

const IMAGES = Array.from({ length: 6 }, (_, index) => ({
    url: `https://res.cloudinary.com/test/image/upload/photo-${index}.jpg`,
    alt: `Photo ${index + 1}`
}));

const t = (key: string, fallback?: string, params?: Record<string, unknown>): string => {
    if (key === 'ui.accessibility.galleryCounter') return `${params?.current}/${params?.total}`;
    return fallback ?? key;
};

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

/** Makes an <img> look decoded, with `currentSrc` as the candidate the browser chose. */
function markPainted({
    img,
    currentSrc
}: {
    readonly img: HTMLImageElement;
    readonly currentSrc: string;
}) {
    Object.defineProperty(img, 'complete', { value: true, configurable: true });
    Object.defineProperty(img, 'naturalWidth', { value: 640, configurable: true });
    Object.defineProperty(img, 'currentSrc', { value: currentSrc, configurable: true });
}

describe('GalleryLightbox placeholder', () => {
    it('first renders the already-painted cell, then swaps to the full image on load', () => {
        // Arrange
        render(
            <ImageGallery
                images={IMAGES}
                locale="en"
            />
        );
        const featured = document.querySelector('[data-gallery-index="0"]') as HTMLElement;
        const cellImg = featured.querySelector('img') as HTMLImageElement;
        markPainted({ img: cellImg, currentSrc: 'https://cdn.test/cell-1000w.jpg' });

        // Act
        fireEvent.click(featured);

        // Assert: placeholder visible at once, full image requested underneath
        const dialog = screen.getByRole('dialog');
        const placeholder = dialog.querySelector('[data-lightbox-placeholder]');
        expect(placeholder).toHaveAttribute('src', 'https://cdn.test/cell-1000w.jpg');
        expect(placeholder).toHaveAttribute('aria-hidden', 'true');
        const full = within(dialog).getByRole('img', { name: 'Photo 1' });
        expect(full).toHaveAttribute('src', buildLightboxUrl({ url: IMAGES[0]?.url ?? '' }).src);
        expect(within(dialog).getByRole('status')).toBeInTheDocument();

        // Act
        fireEvent.load(full);

        // Assert
        expect(dialog.querySelector('[data-lightbox-placeholder]')).toBeNull();
        expect(within(dialog).queryByRole('status')).not.toBeInTheDocument();
    });

    it('shows no placeholder when the cell has not painted yet', () => {
        // Arrange
        render(
            <ImageGallery
                images={IMAGES}
                locale="en"
            />
        );

        // Act
        fireEvent.click(document.querySelector('[data-gallery-index="0"]') as HTMLElement);

        // Assert: the spinner alone, as before
        const dialog = screen.getByRole('dialog');
        expect(dialog.querySelector('[data-lightbox-placeholder]')).toBeNull();
        expect(within(dialog).getByRole('status')).toBeInTheDocument();
    });

    it('keeps counter and keyboard navigation working, with a placeholder per photo', () => {
        // Arrange
        const resolvePlaceholder = vi.fn((index: number) => `https://cdn.test/cell-${index}.jpg`);
        render(
            <GalleryLightbox
                images={IMAGES}
                initialIndex={0}
                onClose={() => undefined}
                t={t}
                resolvePlaceholder={resolvePlaceholder}
            />
        );

        // Act
        fireEvent.keyDown(document, { key: 'ArrowRight' });

        // Assert
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('2/6')).toBeInTheDocument();
        expect(dialog.querySelector('[data-lightbox-placeholder]')).toHaveAttribute(
            'src',
            'https://cdn.test/cell-1.jpg'
        );
        expect(resolvePlaceholder).toHaveBeenCalledWith(1);
    });
});

describe('GalleryLightbox thumbnail strip', () => {
    it('is not rendered in the first commit, only after the dialog paints', () => {
        // Arrange
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frames.push(callback);
            return frames.length;
        });
        vi.stubGlobal('cancelAnimationFrame', () => undefined);

        // Act
        render(
            <GalleryLightbox
                images={IMAGES}
                initialIndex={2}
                onClose={() => undefined}
                t={t}
            />
        );

        // Assert: first commit has the photo but no strip
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).queryAllByRole('listitem')).toHaveLength(0);

        // Act: the frame before paint, then the one after it (other rAF users,
        // such as the dialog's focus handling, share the queue)
        const runQueuedFrames = (time: number) =>
            act(() => {
                for (const callback of frames.splice(0)) callback(time);
            });
        runQueuedFrames(0);
        expect(within(dialog).queryAllByRole('listitem')).toHaveLength(0);
        runQueuedFrames(16);

        // Assert: the strip keeps its buttons and aria
        const items = within(dialog).getAllByRole('listitem');
        expect(items).toHaveLength(IMAGES.length);
        const current = items[2]?.querySelector('button');
        expect(current).toHaveAttribute('aria-current', 'true');
        fireEvent.click(items[4]?.querySelector('button') as HTMLElement);
        expect(within(dialog).getByText('5/6')).toBeInTheDocument();
    });
});
