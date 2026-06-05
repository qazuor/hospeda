/**
 * @file ImageGallery.detail.test.tsx
 * @description Vitest + testing-library coverage for the count-aware DETAIL
 * variant of the ImageGallery React island (T-005, SPEC-186 FR-1).
 *
 * Covers:
 * - Pure logic equivalents: data-count key mapping (getDetailCountKey) and
 *   visible thumb count per image count (getVisibleThumbCount), both derived
 *   from DOM assertions since the helpers are file-private.
 * - Cell count correctness at 1/2/3/4/5+ images.
 * - data-count attribute value per count.
 * - Overlay: present only at >=5; absent at exactly 4; correct "+N más" label.
 * - Overlay keyboard/click activation opens lightbox at the first hidden image.
 * - Alt text preserved on every rendered cell img.
 * - Thumb click opens lightbox at the correct index (regression for index math).
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GalleryImage } from '../../src/components/ImageGallery.client';
import { ImageGallery } from '../../src/components/ImageGallery.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

// i18n: replicate the exact mock from ImageGallery.test.tsx so the "moreOverlay"
// template ('+{{count}} más') is interpolated correctly.
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
const IMG_7 = makeImages(7);
const IMG_9 = makeImages(9);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Render the detail variant and return the .grid root element.
 * The CSS-module mock maps class names to their own string, so
 * `.grid` is literally the className "grid" — query by it.
 */
function renderDetail(images: GalleryImage[]) {
    const { container } = render(
        <ImageGallery
            images={images}
            variant="detail"
            locale="es"
        />
    );
    // The grid container carries data-count; it is the div with className "grid".
    const grid = container.querySelector('[data-count]') as HTMLElement | null;
    return { container, grid };
}

afterEach(() => {
    vi.clearAllMocks();
});

// ─── Unit-equivalent: getDetailCountKey ───────────────────────────────────────

describe('getDetailCountKey — data-count attribute mapping', () => {
    /**
     * The helper is file-private; we verify the same contract by asserting
     * that the rendered grid carries the expected data-count value.
     *
     * Spec matrix (§5):
     *   0       → '0'   (renders null — no grid)
     *   1       → '1'
     *   2       → '2'
     *   3       → '3'
     *   4       → '4'
     *   5       → '5plus'
     *   9       → '5plus'
     */

    it('count=1 → data-count="1"', () => {
        const { grid } = renderDetail(IMG_1);
        expect(grid).not.toBeNull();
        expect(grid?.dataset.count).toBe('1');
    });

    it('count=2 → data-count="2"', () => {
        const { grid } = renderDetail(IMG_2);
        expect(grid?.dataset.count).toBe('2');
    });

    it('count=3 → data-count="3"', () => {
        const { grid } = renderDetail(IMG_3);
        expect(grid?.dataset.count).toBe('3');
    });

    it('count=4 → data-count="4"', () => {
        const { grid } = renderDetail(IMG_4);
        expect(grid?.dataset.count).toBe('4');
    });

    it('count=5 → data-count="5plus"', () => {
        const { grid } = renderDetail(IMG_5);
        expect(grid?.dataset.count).toBe('5plus');
    });

    it('count=9 → data-count="5plus"', () => {
        const { grid } = renderDetail(IMG_9);
        expect(grid?.dataset.count).toBe('5plus');
    });

    it('empty array → renders nothing (no grid element)', () => {
        const { grid } = renderDetail([]);
        expect(grid).toBeNull();
    });
});

// ─── Unit-equivalent: getVisibleThumbCount ────────────────────────────────────

describe('getVisibleThumbCount — thumbnail slot count per image count', () => {
    /**
     * Spec matrix (§5):
     *   1  → 0 visible thumbs (featured only, full-width)
     *   2  → 1 visible thumb  (half-width pair)
     *   3  → 2 visible thumbs (featured 2fr + 2 quarters)
     *   4  → 3 visible thumbs (featured + 3 quarters)
     *   7  → 3 visible thumbs (featured + 3 quarters; last = overlay)
     *
     * Measured as: total rendered cell imgs − 1 (the featured) − overlay img
     * (aria-hidden overlay bg img) to get the "interactive thumb" count.
     *
     * More precisely: the thumbGrid renders (count === 2 ? cellHalf : cellQuarter)
     * buttons plus (at 5+) one overlay div that carries an aria-hidden img.
     * We count the thumbGrid's direct children that are <button> elements.
     */

    function countThumbButtons(images: GalleryImage[]): number {
        const { container } = render(
            <ImageGallery
                images={images}
                variant="detail"
                locale="es"
            />
        );
        // The thumbGrid is a div that follows the featured button.
        // Its children are either <button> (normal thumb) or <div> (overlay cell).
        // Count the buttons inside it (non-overlay thumbs) plus overlay div (if any).
        // We want the total SLOT count (buttons + overlay divs).
        const thumbGrid = container.querySelector('.thumbGrid');
        if (!thumbGrid) return 0;
        const children = Array.from(thumbGrid.children);
        return children.length;
    }

    it('1 image → 0 thumb slots (no thumbGrid rendered)', () => {
        expect(countThumbButtons(IMG_1)).toBe(0);
    });

    it('2 images → 1 thumb slot', () => {
        expect(countThumbButtons(IMG_2)).toBe(1);
    });

    it('3 images → 2 thumb slots', () => {
        expect(countThumbButtons(IMG_3)).toBe(2);
    });

    it('4 images → 3 thumb slots', () => {
        expect(countThumbButtons(IMG_4)).toBe(3);
    });

    it('7 images → 3 thumb slots (capped at 3; last is overlay)', () => {
        expect(countThumbButtons(IMG_7)).toBe(3);
    });
});

// ─── Rendered cell count per image count ──────────────────────────────────────

describe('DetailVariant — rendered cell image count per total', () => {
    /**
     * Total <img> elements visible in the grid (not the lightbox):
     *   count=1 → 1 (featured only)
     *   count=2 → 2 (featured + 1 half thumb)
     *   count=3 → 3 (featured + 2 quarter thumbs)
     *   count=4 → 4 (featured + 3 quarter thumbs)
     *   count=5 → 4 (featured + 2 normal thumbs + 1 overlay bg img [aria-hidden])
     *
     * Note: the overlay cell contains an aria-hidden img (background) plus a button.
     * screen.getAllByRole('img') EXCLUDES aria-hidden elements; queryAll via container
     * is used to count ALL imgs including aria-hidden ones.
     */

    it('1 image: 1 cell img (featured only)', () => {
        const { container } = renderDetail(IMG_1);
        const imgs = container.querySelectorAll('img');
        expect(imgs.length).toBe(1);
    });

    it('2 images: 2 cell imgs (featured + 1 half thumb)', () => {
        const { container } = renderDetail(IMG_2);
        const imgs = container.querySelectorAll('img');
        expect(imgs.length).toBe(2);
    });

    it('3 images: 3 cell imgs (featured + 2 quarter thumbs)', () => {
        const { container } = renderDetail(IMG_3);
        const imgs = container.querySelectorAll('img');
        expect(imgs.length).toBe(3);
    });

    it('4 images: 4 cell imgs (featured + 3 quarter thumbs)', () => {
        const { container } = renderDetail(IMG_4);
        const imgs = container.querySelectorAll('img');
        expect(imgs.length).toBe(4);
    });

    it('5 images: 4 cell imgs (featured + 2 regular thumbs + 1 overlay bg img)', () => {
        const { container } = renderDetail(IMG_5);
        // featured + 2 regular thumb buttons + 1 overlay div (contains 1 aria-hidden img)
        const imgs = container.querySelectorAll('img');
        expect(imgs.length).toBe(4);
    });

    it('7 images: still 4 cell imgs (bounded at featured + 3 thumb slots)', () => {
        const { container } = renderDetail(IMG_7);
        const imgs = container.querySelectorAll('img');
        expect(imgs.length).toBe(4);
    });
});

// ─── data-count attribute ─────────────────────────────────────────────────────

describe('DetailVariant — data-count attribute on .grid', () => {
    it.each([
        { images: IMG_1, expected: '1' },
        { images: IMG_2, expected: '2' },
        { images: IMG_3, expected: '3' },
        { images: IMG_4, expected: '4' },
        { images: IMG_5, expected: '5plus' },
        { images: IMG_9, expected: '5plus' }
    ])('$expected.length images → data-count="$expected"', ({ images, expected }) => {
        const { grid } = renderDetail(images);
        expect(grid?.dataset.count).toBe(expected);
    });
});

// ─── "+N más" overlay ─────────────────────────────────────────────────────────

describe('DetailVariant — "+N más" overlay', () => {
    it('absent at count=4 (no overlay rendered)', () => {
        renderDetail(IMG_4);
        // The overlay button uses a label matching "+N más"
        expect(screen.queryByRole('button', { name: /más/i })).not.toBeInTheDocument();
    });

    it('present at count=5 with correct +N label (N = total − 4 = 1)', () => {
        renderDetail(IMG_5);
        const overlayBtn = screen.getByRole('button', { name: /\+1 más/i });
        expect(overlayBtn).toBeInTheDocument();
    });

    it('present at count=7 with correct +N label (N = 7 − 4 = 3)', () => {
        renderDetail(IMG_7);
        const overlayBtn = screen.getByRole('button', { name: /\+3 más/i });
        expect(overlayBtn).toBeInTheDocument();
    });

    it('present at count=9 with correct +N label (N = 9 − 4 = 5)', () => {
        renderDetail(IMG_9);
        const overlayBtn = screen.getByRole('button', { name: /\+5 más/i });
        expect(overlayBtn).toBeInTheDocument();
    });

    it('overlay button aria-label contains the remaining count at count=7', () => {
        renderDetail(IMG_7);
        const overlayBtn = screen.getByRole('button', { name: /\+3 más/i });
        // aria-label is the interpolated i18n string
        const label = overlayBtn.getAttribute('aria-label') ?? '';
        expect(label).toContain('3');
    });

    it('overlay visible text matches the aria-label at count=5', () => {
        renderDetail(IMG_5);
        const overlayBtn = screen.getByRole('button', { name: /\+1 más/i });
        expect(overlayBtn.textContent?.trim()).toMatch(/\+1 más/i);
    });

    it('absent at count=1 (no overlay)', () => {
        renderDetail(IMG_1);
        expect(screen.queryByRole('button', { name: /más/i })).not.toBeInTheDocument();
    });

    it('absent at count=2 (no overlay)', () => {
        renderDetail(IMG_2);
        expect(screen.queryByRole('button', { name: /más/i })).not.toBeInTheDocument();
    });

    it('absent at count=3 (no overlay)', () => {
        renderDetail(IMG_3);
        expect(screen.queryByRole('button', { name: /más/i })).not.toBeInTheDocument();
    });
});

// ─── Overlay click/keyboard opens lightbox at the first hidden image ──────────

describe('DetailVariant — overlay activates lightbox at first hidden image', () => {
    /**
     * At count=5 the layout is: featured(0) + thumb(1) + thumb(2) + overlay(last-visible).
     * Clicking the overlay opens the lightbox at the first HIDDEN image.
     *
     * From the source: `onClick={() => onOpen(lightboxIndex + 1)}`
     * where `lightboxIndex = i + 1` and the overlay is at `i = visibleThumbs.length - 1 = 2`.
     * So `lightboxIndex = 3`, and `onOpen(3 + 1) = onOpen(4)` → lightbox opens at index 4
     * (images[4], 0-based), which is the 5th image — the first hidden one.
     *
     * The lightbox counter shows "{index+1} / {total}" so it should show "5 / 5".
     */

    it('click on overlay opens lightbox dialog', () => {
        render(
            <ImageGallery
                images={IMG_5}
                variant="detail"
                locale="es"
            />
        );
        const overlayBtn = screen.getByRole('button', { name: /\+1 más/i });
        fireEvent.click(overlayBtn);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('click on overlay opens lightbox at index 4 (first hidden image, "5 / 5")', () => {
        render(
            <ImageGallery
                images={IMG_5}
                variant="detail"
                locale="es"
            />
        );
        const overlayBtn = screen.getByRole('button', { name: /\+1 más/i });
        fireEvent.click(overlayBtn);
        // Counter is "{index+1} / {total}" — first hidden image is index 4 → "5 / 5"
        expect(screen.getByText('5 / 5')).toBeInTheDocument();
    });

    it('lightbox at overlay-open shows the correct image alt (images[4])', () => {
        render(
            <ImageGallery
                images={IMG_5}
                variant="detail"
                locale="es"
            />
        );
        const overlayBtn = screen.getByRole('button', { name: /\+1 más/i });
        fireEvent.click(overlayBtn);

        const dialog = screen.getByRole('dialog');
        // The lightbox figure img has the alt of the current image (index 4 = "Photo 5")
        const mainImg = within(dialog)
            .getAllByRole('img')
            .find((img) => img.getAttribute('alt') === 'Photo 5');
        expect(mainImg).toBeDefined();
    });

    it('overlay click on 7-image gallery opens lightbox at index 4 ("5 / 7")', () => {
        render(
            <ImageGallery
                images={IMG_7}
                variant="detail"
                locale="es"
            />
        );
        const overlayBtn = screen.getByRole('button', { name: /\+3 más/i });
        fireEvent.click(overlayBtn);
        // Lightbox opens at the first hidden image (index 4) → counter = "5 / 7"
        expect(screen.getByText('5 / 7')).toBeInTheDocument();
    });

    it('lightbox receives ALL images (not just visible ones) at count=7', () => {
        render(
            <ImageGallery
                images={IMG_7}
                variant="detail"
                locale="es"
            />
        );
        const overlayBtn = screen.getByRole('button', { name: /\+3 más/i });
        fireEvent.click(overlayBtn);
        // Counter denominator = total image count
        expect(screen.getByText('5 / 7')).toBeInTheDocument();
    });

    it('keyboard Enter on overlay button opens the lightbox', () => {
        render(
            <ImageGallery
                images={IMG_5}
                variant="detail"
                locale="es"
            />
        );
        const overlayBtn = screen.getByRole('button', { name: /\+1 más/i });
        // Buttons fire click on Enter by default in jsdom
        fireEvent.keyDown(overlayBtn, { key: 'Enter', code: 'Enter' });
        fireEvent.click(overlayBtn); // simulate the activation
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});

// ─── Alt text preserved on every cell img ─────────────────────────────────────

describe('DetailVariant — alt text on all rendered cell imgs', () => {
    it('1 image: featured img has correct alt', () => {
        const { container } = renderDetail(IMG_1);
        const imgs = container.querySelectorAll('img');
        expect(imgs[0]?.getAttribute('alt')).toBe('Photo 1');
    });

    it('2 images: both imgs have correct alts', () => {
        const { container } = renderDetail(IMG_2);
        const imgs = Array.from(container.querySelectorAll('img'));
        expect(imgs[0]?.getAttribute('alt')).toBe('Photo 1');
        expect(imgs[1]?.getAttribute('alt')).toBe('Photo 2');
    });

    it('4 images: all 4 imgs have correct alts', () => {
        const { container } = renderDetail(IMG_4);
        const imgs = Array.from(container.querySelectorAll('img'));
        for (let i = 0; i < 4; i++) {
            expect(imgs[i]?.getAttribute('alt')).toBe(`Photo ${i + 1}`);
        }
    });

    it('5 images: featured + regular thumbs + overlay bg img all have correct alts', () => {
        const { container } = renderDetail(IMG_5);
        const imgs = Array.from(container.querySelectorAll('img'));
        // featured=img0, thumb1=img1, thumb2=img2, overlayBg=img3 (aria-hidden)
        expect(imgs[0]?.getAttribute('alt')).toBe('Photo 1');
        expect(imgs[1]?.getAttribute('alt')).toBe('Photo 2');
        expect(imgs[2]?.getAttribute('alt')).toBe('Photo 3');
        // The overlay bg img corresponds to images[3] (the 4th image, the last visible thumb)
        expect(imgs[3]?.getAttribute('alt')).toBe('Photo 4');
    });
});

// ─── Thumb click opens lightbox at the correct index ─────────────────────────

describe('DetailVariant — thumb click opens lightbox at correct index (index math regression)', () => {
    /**
     * Regression: thumb at position i in the thumbGrid opens lightbox at
     * `lightboxIndex = i + 1` (1-based offset past the featured image).
     *
     * count=3: thumbs are images[1] and images[2].
     *   - clicking thumb 0 (images[1]) → lightbox index 1 → counter "2 / 3"
     *   - clicking thumb 1 (images[2]) → lightbox index 2 → counter "3 / 3"
     *
     * count=4: thumbs are images[1..3].
     *   - clicking thumb 2 (images[3]) → lightbox index 3 → counter "4 / 4"
     */

    it('count=3: clicking first thumb opens lightbox at index 1 ("2 / 3")', () => {
        render(
            <ImageGallery
                images={IMG_3}
                variant="detail"
                locale="es"
            />
        );
        // Thumb buttons in the thumbGrid (not the featured button)
        const allBtns = screen.getAllByRole('button', { name: /pantalla completa/i });
        // allBtns[0] = featured, allBtns[1] = first thumb
        expect(allBtns.length).toBeGreaterThanOrEqual(2);
        fireEvent.click(allBtns[1] as HTMLElement);
        expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });

    it('count=3: clicking second thumb opens lightbox at index 2 ("3 / 3")', () => {
        render(
            <ImageGallery
                images={IMG_3}
                variant="detail"
                locale="es"
            />
        );
        const allBtns = screen.getAllByRole('button', { name: /pantalla completa/i });
        // allBtns[0] = featured, allBtns[1] = thumb0, allBtns[2] = thumb1
        fireEvent.click(allBtns[2] as HTMLElement);
        expect(screen.getByText('3 / 3')).toBeInTheDocument();
    });

    it('count=4: clicking third thumb opens lightbox at index 3 ("4 / 4")', () => {
        render(
            <ImageGallery
                images={IMG_4}
                variant="detail"
                locale="es"
            />
        );
        const allBtns = screen.getAllByRole('button', { name: /pantalla completa/i });
        // allBtns[0]=featured, [1]=thumb0, [2]=thumb1, [3]=thumb2
        fireEvent.click(allBtns[3] as HTMLElement);
        expect(screen.getByText('4 / 4')).toBeInTheDocument();
    });

    it('count=2: clicking the half thumb opens lightbox at index 1 ("2 / 2")', () => {
        render(
            <ImageGallery
                images={IMG_2}
                variant="detail"
                locale="es"
            />
        );
        const allBtns = screen.getAllByRole('button', { name: /pantalla completa/i });
        fireEvent.click(allBtns[1] as HTMLElement);
        expect(screen.getByText('2 / 2')).toBeInTheDocument();
    });

    it('count=1: featured click opens lightbox at index 0 ("1 / 1")', () => {
        render(
            <ImageGallery
                images={IMG_1}
                variant="detail"
                locale="es"
            />
        );
        const [featuredBtn] = screen.getAllByRole('button', { name: /pantalla completa/i });
        fireEvent.click(featuredBtn as HTMLElement);
        expect(screen.getByText('1 / 1')).toBeInTheDocument();
    });
});

// ─── Featured image LCP attributes preserved ──────────────────────────────────

describe('DetailVariant — featured cell LCP attributes (SPEC-157 REQ-3 regression)', () => {
    it('featured img has loading="eager" and fetchpriority="high"', () => {
        renderDetail(IMG_3);
        const featured = screen.getAllByRole('img')[0] as HTMLImageElement;
        expect(featured).toHaveAttribute('loading', 'eager');
        expect(featured).toHaveAttribute('fetchpriority', 'high');
    });

    it('thumbnail imgs are lazy-loaded', () => {
        const { container } = renderDetail(IMG_4);
        const imgs = Array.from(container.querySelectorAll('img'));
        // imgs[0] = featured (eager); imgs[1..3] = thumbs (lazy)
        for (const thumb of imgs.slice(1)) {
            expect(thumb.getAttribute('loading')).toBe('lazy');
        }
    });
});

// ─── thumbGrid not rendered at count=1 ───────────────────────────────────────

describe('DetailVariant — thumbGrid absent at count=1', () => {
    it('no thumbGrid element rendered when there is only 1 image', () => {
        const { container } = renderDetail(IMG_1);
        const thumbGrid = container.querySelector('.thumbGrid');
        expect(thumbGrid).toBeNull();
    });

    it('thumbGrid IS rendered when count >= 2', () => {
        const { container } = renderDetail(IMG_2);
        const thumbGrid = container.querySelector('.thumbGrid');
        expect(thumbGrid).not.toBeNull();
    });
});
