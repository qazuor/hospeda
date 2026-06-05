/**
 * @file ImageGallery.coverPlusGrid.test.tsx
 * @description Vitest + testing-library coverage for the count-aware COVER-PLUS-GRID
 * variant of the ImageGallery React island (T-007, SPEC-186 FR-2).
 *
 * Covers:
 * - Direct unit tests for getCoverExtrasCountKey and getVisibleExtrasCount (exported).
 * - Per-count rendering: 1 (cover only), 2 (1 half extra), 3 (2 halfs), 4 (3 quarters),
 *   5+ (3 quarters + overlay).
 * - data-extras-count attribute on .inlineGrid per count.
 * - Overlay: present only at >=5 total; absent at exactly 4; correct "+N más" label.
 * - Overlay visible text matches aria-label; absent at <=4.
 * - Overlay click and keyboard Enter open lightbox at first hidden image.
 * - Lightbox counter format "{index+1} / {total}" and receives ALL images.
 * - Cover click opens lightbox at index 0 ("1 / N").
 * - Extra-cell clicks open lightbox at correct indexes (regression for index math).
 * - Alt text preserved on all rendered imgs (including aria-hidden overlay bg img).
 * - Cover img loading attributes (eager); extras lazy.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
    getCoverExtrasCountKey,
    getVisibleExtrasCount
} from '../../src/components/ImageGallery.client';
import type { GalleryImage } from '../../src/components/ImageGallery.client';
import { ImageGallery } from '../../src/components/ImageGallery.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

// i18n: replicate the exact mock from ImageGallery.detail.test.tsx so the
// moreOverlay template ('+{{count}} más') is interpolated correctly.
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

// CSS modules: identity proxy so className lookups return the class-name string.
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

/** Build N gallery images with predictable URLs and alts. */
function makeImages(count: number): GalleryImage[] {
    return Array.from({ length: count }, (_, i) => ({
        url: `/img${i + 1}.jpg`,
        alt: `Photo ${i + 1}`
    }));
}

const IMG_1 = makeImages(1);
const IMG_2 = makeImages(2);
const IMG_3 = makeImages(3);
const IMG_4 = makeImages(4);
const IMG_5 = makeImages(5);
const IMG_8 = makeImages(8);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Render the cover-plus-grid variant and return the .inlineGrid root element
 * (present only when extras >= 1) and the container.
 * The CSS-module mock maps class names to their own string, so
 * `.inlineGrid` is literally the className "inlineGrid".
 */
function renderCoverPlusGrid(images: GalleryImage[]) {
    const { container } = render(
        <ImageGallery
            images={images}
            variant="cover-plus-grid"
            locale="es"
        />
    );
    // inlineGrid carries data-extras-count; present only when extras >= 1
    const inlineGrid = container.querySelector('[data-extras-count]') as HTMLElement | null;
    return { container, inlineGrid };
}

afterEach(() => {
    vi.clearAllMocks();
});

// ─── Direct unit tests for exported helpers ───────────────────────────────────

describe('getCoverExtrasCountKey — exported pure helper', () => {
    /**
     * Spec matrix (§5, cover-plus-grid variant):
     *   <=1  → '0'
     *   2    → '1'
     *   3    → '2'
     *   4    → '3'
     *   5+   → '3plus'
     */

    it('totalCount=0 → "0"', () => {
        expect(getCoverExtrasCountKey(0)).toBe('0');
    });

    it('totalCount=1 → "0"', () => {
        expect(getCoverExtrasCountKey(1)).toBe('0');
    });

    it('totalCount=2 → "1"', () => {
        expect(getCoverExtrasCountKey(2)).toBe('1');
    });

    it('totalCount=3 → "2"', () => {
        expect(getCoverExtrasCountKey(3)).toBe('2');
    });

    it('totalCount=4 → "3"', () => {
        expect(getCoverExtrasCountKey(4)).toBe('3');
    });

    it('totalCount=5 → "3plus"', () => {
        expect(getCoverExtrasCountKey(5)).toBe('3plus');
    });

    it('totalCount=8 → "3plus"', () => {
        expect(getCoverExtrasCountKey(8)).toBe('3plus');
    });

    it('totalCount=100 → "3plus"', () => {
        expect(getCoverExtrasCountKey(100)).toBe('3plus');
    });
});

describe('getVisibleExtrasCount — exported pure helper', () => {
    /**
     * Spec matrix (§5):
     *   <=1  → 0 (cover only)
     *   2    → 1 (1 half cell)
     *   3    → 2 (2 half cells)
     *   4    → 3 (3 quarter cells)
     *   5+   → 3 (3 quarter cells; last = overlay)
     */

    it('totalCount=0 → 0', () => {
        expect(getVisibleExtrasCount(0)).toBe(0);
    });

    it('totalCount=1 → 0', () => {
        expect(getVisibleExtrasCount(1)).toBe(0);
    });

    it('totalCount=2 → 1', () => {
        expect(getVisibleExtrasCount(2)).toBe(1);
    });

    it('totalCount=3 → 2', () => {
        expect(getVisibleExtrasCount(3)).toBe(2);
    });

    it('totalCount=4 → 3', () => {
        expect(getVisibleExtrasCount(4)).toBe(3);
    });

    it('totalCount=5 → 3 (capped; last is overlay)', () => {
        expect(getVisibleExtrasCount(5)).toBe(3);
    });

    it('totalCount=8 → 3 (capped; last is overlay)', () => {
        expect(getVisibleExtrasCount(8)).toBe(3);
    });
});

// ─── Per-count rendering ──────────────────────────────────────────────────────

describe('CoverPlusGridVariant — per-count rendering', () => {
    it('total=1: renders cover only, no inlineGrid', () => {
        const { container, inlineGrid } = renderCoverPlusGrid(IMG_1);
        // No extras grid rendered
        expect(inlineGrid).toBeNull();
        // Only 1 img: the cover
        const imgs = container.querySelectorAll('img');
        expect(imgs.length).toBe(1);
    });

    it('total=2: cover + 1 half extra (2 imgs total)', () => {
        const { container, inlineGrid } = renderCoverPlusGrid(IMG_2);
        expect(inlineGrid).not.toBeNull();
        const imgs = container.querySelectorAll('img');
        // cover img + 1 extra img
        expect(imgs.length).toBe(2);
    });

    it('total=3: cover + 2 half extras (3 imgs total)', () => {
        const { container, inlineGrid } = renderCoverPlusGrid(IMG_3);
        expect(inlineGrid).not.toBeNull();
        const imgs = container.querySelectorAll('img');
        // cover img + 2 extra imgs
        expect(imgs.length).toBe(3);
    });

    it('total=4: cover + 3 quarter extras (4 imgs total)', () => {
        const { container, inlineGrid } = renderCoverPlusGrid(IMG_4);
        expect(inlineGrid).not.toBeNull();
        const imgs = container.querySelectorAll('img');
        // cover img + 3 extra imgs
        expect(imgs.length).toBe(4);
    });

    it('total=5: cover + 2 quarter extras + 1 overlay cell (4 imgs total: cover + 2 normal + 1 overlay bg)', () => {
        const { container, inlineGrid } = renderCoverPlusGrid(IMG_5);
        expect(inlineGrid).not.toBeNull();
        // cover + 2 regular extra buttons + 1 overlay div (with 1 aria-hidden img)
        const imgs = container.querySelectorAll('img');
        expect(imgs.length).toBe(4);
    });

    it('total=8: same bounded layout as 5+ (4 imgs total: cover + 2 normal + 1 overlay bg)', () => {
        const { container, inlineGrid } = renderCoverPlusGrid(IMG_8);
        expect(inlineGrid).not.toBeNull();
        const imgs = container.querySelectorAll('img');
        expect(imgs.length).toBe(4);
    });
});

// ─── Extra slot counts in inlineGrid ─────────────────────────────────────────

describe('CoverPlusGridVariant — extras slot count in inlineGrid', () => {
    /**
     * Count the direct children of the inlineGrid (buttons + overlay divs).
     * This mirrors the T-005 pattern for thumbGrid slot counting.
     */

    function countInlineGridSlots(images: GalleryImage[]): number {
        const { container } = render(
            <ImageGallery
                images={images}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const inlineGrid = container.querySelector('.inlineGrid');
        if (!inlineGrid) return 0;
        return Array.from(inlineGrid.children).length;
    }

    it('total=1 → 0 extras slots (no inlineGrid rendered)', () => {
        expect(countInlineGridSlots(IMG_1)).toBe(0);
    });

    it('total=2 → 1 extras slot', () => {
        expect(countInlineGridSlots(IMG_2)).toBe(1);
    });

    it('total=3 → 2 extras slots', () => {
        expect(countInlineGridSlots(IMG_3)).toBe(2);
    });

    it('total=4 → 3 extras slots', () => {
        expect(countInlineGridSlots(IMG_4)).toBe(3);
    });

    it('total=5 → 3 extras slots (capped; last is overlay)', () => {
        expect(countInlineGridSlots(IMG_5)).toBe(3);
    });

    it('total=8 → 3 extras slots (capped; last is overlay)', () => {
        expect(countInlineGridSlots(IMG_8)).toBe(3);
    });
});

// ─── data-extras-count attribute ─────────────────────────────────────────────

describe('CoverPlusGridVariant — data-extras-count attribute on .inlineGrid', () => {
    it.each([
        { images: IMG_2, expected: '1' },
        { images: IMG_3, expected: '2' },
        { images: IMG_4, expected: '3' },
        { images: IMG_5, expected: '3plus' },
        { images: IMG_8, expected: '3plus' }
    ])('total=$images.length → data-extras-count="$expected"', ({ images, expected }) => {
        const { inlineGrid } = renderCoverPlusGrid(images);
        expect(inlineGrid).not.toBeNull();
        expect(inlineGrid?.dataset.extrasCount).toBe(expected);
    });

    it('total=1 → no inlineGrid (no data-extras-count attribute rendered)', () => {
        const { inlineGrid } = renderCoverPlusGrid(IMG_1);
        expect(inlineGrid).toBeNull();
    });
});

// ─── "+N más" overlay presence and label ────────────────────────────────────

describe('CoverPlusGridVariant — "+N más" overlay', () => {
    it('absent at total=1 (no overlay rendered)', () => {
        renderCoverPlusGrid(IMG_1);
        expect(screen.queryByRole('button', { name: /más/i })).not.toBeInTheDocument();
    });

    it('absent at total=2 (no overlay)', () => {
        renderCoverPlusGrid(IMG_2);
        expect(screen.queryByRole('button', { name: /más/i })).not.toBeInTheDocument();
    });

    it('absent at total=3 (no overlay)', () => {
        renderCoverPlusGrid(IMG_3);
        expect(screen.queryByRole('button', { name: /más/i })).not.toBeInTheDocument();
    });

    it('absent at total=4 (no overlay rendered)', () => {
        renderCoverPlusGrid(IMG_4);
        // The moreOverlayBtn only appears at 5+
        expect(screen.queryByRole('button', { name: /más/i })).not.toBeInTheDocument();
    });

    it('present at total=5 with correct +N label (N = 5 - 4 = 1)', () => {
        renderCoverPlusGrid(IMG_5);
        const overlayBtn = screen.getByRole('button', { name: /\+1 más/i });
        expect(overlayBtn).toBeInTheDocument();
    });

    it('present at total=8 with correct +N label (N = 8 - 4 = 4)', () => {
        renderCoverPlusGrid(IMG_8);
        const overlayBtn = screen.getByRole('button', { name: /\+4 más/i });
        expect(overlayBtn).toBeInTheDocument();
    });

    it('overlay button aria-label contains the remaining count at total=5', () => {
        renderCoverPlusGrid(IMG_5);
        const overlayBtn = screen.getByRole('button', { name: /\+1 más/i });
        const label = overlayBtn.getAttribute('aria-label') ?? '';
        expect(label).toContain('1');
    });

    it('overlay button aria-label contains the remaining count at total=8', () => {
        renderCoverPlusGrid(IMG_8);
        const overlayBtn = screen.getByRole('button', { name: /\+4 más/i });
        const label = overlayBtn.getAttribute('aria-label') ?? '';
        expect(label).toContain('4');
    });

    it('overlay visible text matches the aria-label at total=5', () => {
        renderCoverPlusGrid(IMG_5);
        const overlayBtn = screen.getByRole('button', { name: /\+1 más/i });
        // Visible text content must match the aria-label (not differ from screen-reader announcement)
        expect(overlayBtn.textContent?.trim()).toMatch(/\+1 más/i);
        const ariaLabel = overlayBtn.getAttribute('aria-label') ?? '';
        expect(overlayBtn.textContent?.trim()).toBe(ariaLabel);
    });

    it('overlay visible text matches the aria-label at total=8', () => {
        renderCoverPlusGrid(IMG_8);
        const overlayBtn = screen.getByRole('button', { name: /\+4 más/i });
        expect(overlayBtn.textContent?.trim()).toMatch(/\+4 más/i);
        const ariaLabel = overlayBtn.getAttribute('aria-label') ?? '';
        expect(overlayBtn.textContent?.trim()).toBe(ariaLabel);
    });
});

// ─── Overlay click / keyboard opens lightbox at first hidden image ────────────

describe('CoverPlusGridVariant — overlay activates lightbox at first hidden image', () => {
    /**
     * At total=5 the layout is: cover(0) + extra(1) + extra(2) + overlay(last-visible).
     * Clicking the overlay opens the lightbox at the first HIDDEN image.
     *
     * From the source:
     *   isOverlayCell: i === visibleExtras.length - 1 = 2
     *   lightboxIndex = i + 1 = 3
     *   onClick={() => onOpen(lightboxIndex + 1)} = onOpen(4)
     *
     * So lightbox opens at index 4 (images[4], 0-based = 5th image).
     * Counter shows "{index+1} / {total}" → "5 / 5".
     */

    it('click on overlay opens lightbox dialog at total=5', () => {
        render(
            <ImageGallery
                images={IMG_5}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const overlayBtn = screen.getByRole('button', { name: /\+1 más/i });
        fireEvent.click(overlayBtn);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('click on overlay opens lightbox at index 4 ("5 / 5") at total=5', () => {
        render(
            <ImageGallery
                images={IMG_5}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const overlayBtn = screen.getByRole('button', { name: /\+1 más/i });
        fireEvent.click(overlayBtn);
        // First hidden image is index 4 → counter "5 / 5"
        expect(screen.getByText('5 / 5')).toBeInTheDocument();
    });

    it('lightbox shows the correct image alt at overlay click (images[4] = "Photo 5") at total=5', () => {
        render(
            <ImageGallery
                images={IMG_5}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const overlayBtn = screen.getByRole('button', { name: /\+1 más/i });
        fireEvent.click(overlayBtn);
        const dialog = screen.getByRole('dialog');
        const mainImg = within(dialog)
            .getAllByRole('img')
            .find((img) => img.getAttribute('alt') === 'Photo 5');
        expect(mainImg).toBeDefined();
    });

    it('click on overlay at total=8 opens lightbox at index 4 ("5 / 8")', () => {
        render(
            <ImageGallery
                images={IMG_8}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const overlayBtn = screen.getByRole('button', { name: /\+4 más/i });
        fireEvent.click(overlayBtn);
        // First hidden image is still index 4 (cover=0, extras[0..2] = 1..3, overlay target = 4)
        expect(screen.getByText('5 / 8')).toBeInTheDocument();
    });

    it('lightbox receives ALL images (not just visible ones) at total=8', () => {
        render(
            <ImageGallery
                images={IMG_8}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const overlayBtn = screen.getByRole('button', { name: /\+4 más/i });
        fireEvent.click(overlayBtn);
        // Denominator = total image count
        expect(screen.getByText('5 / 8')).toBeInTheDocument();
    });

    it('keyboard Enter on overlay button opens the lightbox at total=5', () => {
        render(
            <ImageGallery
                images={IMG_5}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const overlayBtn = screen.getByRole('button', { name: /\+1 más/i });
        // Buttons fire click on Enter natively in browsers; simulate keyDown then click
        fireEvent.keyDown(overlayBtn, { key: 'Enter', code: 'Enter' });
        fireEvent.click(overlayBtn);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('keyboard Enter on overlay opens lightbox at first hidden image ("5 / 5")', () => {
        render(
            <ImageGallery
                images={IMG_5}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const overlayBtn = screen.getByRole('button', { name: /\+1 más/i });
        fireEvent.keyDown(overlayBtn, { key: 'Enter', code: 'Enter' });
        fireEvent.click(overlayBtn);
        expect(screen.getByText('5 / 5')).toBeInTheDocument();
    });
});

// ─── Cover click opens lightbox at index 0 ───────────────────────────────────

describe('CoverPlusGridVariant — cover click opens lightbox at index 0', () => {
    /**
     * The cover button fires onOpen(0).
     * Counter shows "1 / N" for any N.
     */

    it('cover click at total=1 opens lightbox at "1 / 1"', () => {
        render(
            <ImageGallery
                images={IMG_1}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const [coverBtn] = screen.getAllByRole('button', { name: /pantalla completa/i });
        fireEvent.click(coverBtn as HTMLElement);
        // Single image → no counter rendered (lightbox hides nav/counter for single image)
        // But we confirm the dialog opened
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('cover click at total=5 opens lightbox at "1 / 5"', () => {
        render(
            <ImageGallery
                images={IMG_5}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        // The cover button is the first "Ver en pantalla completa" button
        const allBtns = screen.getAllByRole('button', { name: /pantalla completa/i });
        fireEvent.click(allBtns[0] as HTMLElement);
        expect(screen.getByText('1 / 5')).toBeInTheDocument();
    });

    it('cover click at total=8 opens lightbox at "1 / 8"', () => {
        render(
            <ImageGallery
                images={IMG_8}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const allBtns = screen.getAllByRole('button', { name: /pantalla completa/i });
        fireEvent.click(allBtns[0] as HTMLElement);
        expect(screen.getByText('1 / 8')).toBeInTheDocument();
    });
});

// ─── Extra-cell clicks open lightbox at correct indexes ──────────────────────

describe('CoverPlusGridVariant — extra-cell clicks open lightbox at correct index (index math regression)', () => {
    /**
     * The cover is images[0] (index 0). Extra cells start at images[1..].
     * In CoverPlusGridVariant:
     *   lightboxIndex = i + 1  (cover = index 0, extra i=0 → index 1, etc.)
     *
     * For total=3: extras are images[1] and images[2].
     *   - clicking extra i=0 (images[1]) → lightbox index 1 → counter "2 / 3"
     *   - clicking extra i=1 (images[2]) → lightbox index 2 → counter "3 / 3"
     *
     * For total=4: extras are images[1..3].
     *   - clicking extra i=2 (images[3]) → lightbox index 3 → counter "4 / 4"
     */

    it('total=2: clicking the half extra opens lightbox at index 1 ("2 / 2")', () => {
        render(
            <ImageGallery
                images={IMG_2}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const allBtns = screen.getAllByRole('button', { name: /pantalla completa/i });
        // allBtns[0] = cover, allBtns[1] = first extra
        expect(allBtns.length).toBeGreaterThanOrEqual(2);
        fireEvent.click(allBtns[1] as HTMLElement);
        expect(screen.getByText('2 / 2')).toBeInTheDocument();
    });

    it('total=3: clicking first half extra opens lightbox at index 1 ("2 / 3")', () => {
        render(
            <ImageGallery
                images={IMG_3}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const allBtns = screen.getAllByRole('button', { name: /pantalla completa/i });
        // allBtns[0] = cover, [1] = extra i=0, [2] = extra i=1
        fireEvent.click(allBtns[1] as HTMLElement);
        expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });

    it('total=3: clicking second half extra opens lightbox at index 2 ("3 / 3")', () => {
        render(
            <ImageGallery
                images={IMG_3}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const allBtns = screen.getAllByRole('button', { name: /pantalla completa/i });
        fireEvent.click(allBtns[2] as HTMLElement);
        expect(screen.getByText('3 / 3')).toBeInTheDocument();
    });

    it('total=4: clicking third quarter extra opens lightbox at index 3 ("4 / 4")', () => {
        render(
            <ImageGallery
                images={IMG_4}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const allBtns = screen.getAllByRole('button', { name: /pantalla completa/i });
        // allBtns[0]=cover, [1]=extra i=0, [2]=extra i=1, [3]=extra i=2
        fireEvent.click(allBtns[3] as HTMLElement);
        expect(screen.getByText('4 / 4')).toBeInTheDocument();
    });

    it('total=4: clicking first quarter extra opens lightbox at index 1 ("2 / 4")', () => {
        render(
            <ImageGallery
                images={IMG_4}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        const allBtns = screen.getAllByRole('button', { name: /pantalla completa/i });
        fireEvent.click(allBtns[1] as HTMLElement);
        expect(screen.getByText('2 / 4')).toBeInTheDocument();
    });
});

// ─── Alt text preserved on all rendered cell imgs ────────────────────────────

describe('CoverPlusGridVariant — alt text on all rendered cell imgs', () => {
    /**
     * querySelectorAll('img') returns ALL imgs including aria-hidden overlay bg img.
     * At total=5: cover=img0, extra1=img1, extra2=img2, overlayBg=img3 (aria-hidden).
     */

    it('total=1: cover img has correct alt', () => {
        const { container } = renderCoverPlusGrid(IMG_1);
        const imgs = container.querySelectorAll('img');
        expect(imgs[0]?.getAttribute('alt')).toBe('Photo 1');
    });

    it('total=2: cover and extra have correct alts', () => {
        const { container } = renderCoverPlusGrid(IMG_2);
        const imgs = Array.from(container.querySelectorAll('img'));
        expect(imgs[0]?.getAttribute('alt')).toBe('Photo 1');
        expect(imgs[1]?.getAttribute('alt')).toBe('Photo 2');
    });

    it('total=3: cover and 2 extras have correct alts', () => {
        const { container } = renderCoverPlusGrid(IMG_3);
        const imgs = Array.from(container.querySelectorAll('img'));
        expect(imgs[0]?.getAttribute('alt')).toBe('Photo 1');
        expect(imgs[1]?.getAttribute('alt')).toBe('Photo 2');
        expect(imgs[2]?.getAttribute('alt')).toBe('Photo 3');
    });

    it('total=4: cover and 3 extras have correct alts', () => {
        const { container } = renderCoverPlusGrid(IMG_4);
        const imgs = Array.from(container.querySelectorAll('img'));
        for (let i = 0; i < 4; i++) {
            expect(imgs[i]?.getAttribute('alt')).toBe(`Photo ${i + 1}`);
        }
    });

    it('total=5: cover + 2 regular extras + overlay bg img all have correct alts', () => {
        const { container } = renderCoverPlusGrid(IMG_5);
        const imgs = Array.from(container.querySelectorAll('img'));
        // cover=img0 (Photo 1), extra1=img1 (Photo 2), extra2=img2 (Photo 3),
        // overlayBg=img3 (Photo 4, aria-hidden — corresponds to visibleExtras[2] = images[3])
        expect(imgs[0]?.getAttribute('alt')).toBe('Photo 1');
        expect(imgs[1]?.getAttribute('alt')).toBe('Photo 2');
        expect(imgs[2]?.getAttribute('alt')).toBe('Photo 3');
        // The overlay bg img corresponds to images[3] — the last visible extra before the overlay button
        expect(imgs[3]?.getAttribute('alt')).toBe('Photo 4');
    });
});

// ─── Cover img loading attributes ────────────────────────────────────────────

describe('CoverPlusGridVariant — cover cell loading attributes', () => {
    /**
     * The cover is the above-the-fold image for posts/destinations; it should
     * use loading="eager" to be fetched promptly. Extra cells are below the fold
     * and should be lazy.
     */

    it('cover img has loading="eager"', () => {
        renderCoverPlusGrid(IMG_3);
        // getAllByRole('img') excludes aria-hidden; first non-hidden img is the cover
        const imgs = screen.getAllByRole('img');
        expect(imgs[0]).toHaveAttribute('loading', 'eager');
    });

    it('extra imgs are lazy-loaded', () => {
        const { container } = renderCoverPlusGrid(IMG_4);
        const allImgs = Array.from(container.querySelectorAll('img'));
        // allImgs[0] = cover (eager); allImgs[1..3] = extras (lazy)
        for (const extraImg of allImgs.slice(1)) {
            expect(extraImg.getAttribute('loading')).toBe('lazy');
        }
    });

    it('overlay bg img (aria-hidden) is also lazy', () => {
        const { container } = renderCoverPlusGrid(IMG_5);
        const allImgs = Array.from(container.querySelectorAll('img'));
        // allImgs[0] = cover (eager), [1] = extra1 (lazy), [2] = extra2 (lazy), [3] = overlay bg (lazy)
        expect(allImgs[3]?.getAttribute('loading')).toBe('lazy');
        expect(allImgs[3]?.getAttribute('aria-hidden')).toBe('true');
    });
});

// ─── inlineGrid not rendered at total=1 ──────────────────────────────────────

describe('CoverPlusGridVariant — inlineGrid absent when no extras', () => {
    it('no inlineGrid element rendered when there is only 1 image', () => {
        const { container } = renderCoverPlusGrid(IMG_1);
        const inlineGrid = container.querySelector('.inlineGrid');
        expect(inlineGrid).toBeNull();
    });

    it('inlineGrid IS rendered when total >= 2', () => {
        const { container } = renderCoverPlusGrid(IMG_2);
        const inlineGrid = container.querySelector('.inlineGrid');
        expect(inlineGrid).not.toBeNull();
    });
});

// ─── Empty array renders nothing ─────────────────────────────────────────────

describe('CoverPlusGridVariant — empty images array', () => {
    it('renders nothing when images array is empty', () => {
        const { container } = render(
            <ImageGallery
                images={[]}
                variant="cover-plus-grid"
                locale="es"
            />
        );
        expect(container.firstChild).toBeNull();
    });
});

// ─── Cell class names (half vs quarter) ──────────────────────────────────────

describe('CoverPlusGridVariant — cell class names per count', () => {
    /**
     * counts 2-3 use cellHalf (4:3 aspect ratio)
     * counts 4-5+ use cellQuarter (1:1 aspect ratio)
     */

    it('total=2: extra button has class "cellHalf"', () => {
        const { container } = renderCoverPlusGrid(IMG_2);
        const inlineGrid = container.querySelector('.inlineGrid');
        const firstChild = inlineGrid?.firstElementChild;
        expect(firstChild?.classList.contains('cellHalf')).toBe(true);
    });

    it('total=3: extra buttons have class "cellHalf"', () => {
        const { container } = renderCoverPlusGrid(IMG_3);
        const inlineGrid = container.querySelector('.inlineGrid');
        const children = Array.from(inlineGrid?.children ?? []);
        for (const child of children) {
            expect(child.classList.contains('cellHalf')).toBe(true);
        }
    });

    it('total=4: extra buttons have class "cellQuarter"', () => {
        const { container } = renderCoverPlusGrid(IMG_4);
        const inlineGrid = container.querySelector('.inlineGrid');
        const children = Array.from(inlineGrid?.children ?? []);
        for (const child of children) {
            expect(child.classList.contains('cellQuarter')).toBe(true);
        }
    });

    it('total=5: all 3 extras slots (including overlay) have class "cellQuarter"', () => {
        const { container } = renderCoverPlusGrid(IMG_5);
        const inlineGrid = container.querySelector('.inlineGrid');
        const children = Array.from(inlineGrid?.children ?? []);
        expect(children.length).toBe(3);
        for (const child of children) {
            expect(child.classList.contains('cellQuarter')).toBe(true);
        }
    });
});
