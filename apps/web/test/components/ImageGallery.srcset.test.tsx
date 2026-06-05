/**
 * @file ImageGallery.srcset.test.tsx
 * @description Vitest + testing-library coverage for srcset wiring and LCP guard
 * in the ImageGallery React island (T-013, SPEC-186 §8 step 10).
 *
 * Covers:
 * 1. Per-role srcset: featured (640/1000/1400w), quarter (200/400/600w), half (400/640/900w).
 * 2. cover-plus-grid: cover uses featured candidates; extras use half (<=3) or quarter (>=4).
 * 3. Every srcset URL contains c_fill and the correct ar_ token for its role.
 * 4. Non-Cloudinary URLs: no srcset and no sizes attribute (guard regression).
 * 5. LCP guard: featured img is eager+high, srcset candidates are exactly {640,1000,1400},
 *    thumbs are lazy.
 * 6. Lightbox main image: single src, URL does NOT contain c_fill/ar_ (uncropped 'full' preset).
 *
 * All Cloudinary mock URLs use the canonical res.cloudinary.com format so that
 * `isCloudinaryUrl` / `buildCellSrcset` activate the srcset path.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GalleryImage } from '../../src/components/ImageGallery.client';
import { ImageGallery } from '../../src/components/ImageGallery.client';

// ─── Module mocks ──────────────────────────────────────────────────────────────

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

/**
 * Canonical Cloudinary base URL used across all srcset tests.
 * The URL has NO existing transform segment so `buildCellUrl` can inject the
 * correct per-role preset without the `hasExistingTransform` guard firing.
 */
const CLD_BASE = 'https://res.cloudinary.com/demo/image/upload/v123';

/** Build N Cloudinary gallery images with predictable public-id paths. */
function makeCloudinaryImages(count: number): GalleryImage[] {
    return Array.from({ length: count }, (_, i) => ({
        url: `${CLD_BASE}/sample${i + 1}.jpg`,
        alt: `Photo ${i + 1}`
    }));
}

/** Build N non-Cloudinary gallery images (local paths — NO srcset expected). */
function makeLocalImages(count: number): GalleryImage[] {
    return Array.from({ length: count }, (_, i) => ({
        url: `/img${i + 1}.jpg`,
        alt: `Photo ${i + 1}`
    }));
}

// Pre-built fixtures for the most common counts.
const CLD_5 = makeCloudinaryImages(5);
const CLD_2 = makeCloudinaryImages(2);
const CLD_4 = makeCloudinaryImages(4);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse the srcset attribute string into an array of { url, descriptor } entries.
 * Returns [] when srcset is absent.
 *
 * NOTE: Cloudinary transform URLs contain commas inside the transform segment
 * (e.g. `w_640,ar_16:10,c_fill,...`). A naive split on "," would produce
 * spurious entries. The correct split boundary is a ", " (comma + space) that
 * is followed by a URL — i.e. where the next token after `, ` starts with
 * "http" or "/". We split on the pattern `\s+\d+w\s*,\s*` which matches the
 * trailing descriptor + comma between srcset entries, then re-attach the
 * descriptor to each entry.
 *
 * Concretely a 3-candidate srcset looks like:
 *   `<url1> 640w, <url2> 1000w, <url3> 1400w`
 * where <urlN> contains internal commas (Cloudinary transforms). The safe
 * split is on ` <digits>w, ` boundaries.
 */
function parseSrcset(el: HTMLElement | Element): Array<{ url: string; descriptor: string }> {
    const raw = el.getAttribute('srcset');
    if (!raw) return [];
    // Match each entry as (url, descriptor) pair without splitting on commas
    // inside Cloudinary transform URLs (e.g. `w_640,ar_16:10,c_fill,...`).
    // Each candidate in the srcset is `<url> <N>w` where the URL contains
    // no spaces — so /(\S+)\s+(\d+w)/ correctly captures each pair.
    const regex = /(\S+)\s+(\d+w)/g;
    return Array.from(raw.matchAll(regex), (m) => ({
        url: m[1] ?? '',
        descriptor: m[2] ?? ''
    }));
}

/**
 * Extract the numeric width (in px) encoded in a srcset width descriptor string,
 * e.g. "640w" → 640.
 */
function descriptorWidth(descriptor: string): number {
    return Number.parseInt(descriptor.replace('w', ''), 10);
}

// ─── 1. Per-role srcset — detail variant ─────────────────────────────────────

describe('Detail variant — per-role srcset (Cloudinary URLs)', () => {
    /**
     * Render 5 Cloudinary images in the detail variant.
     * Layout: featured(0) + thumb(1) + thumb(2) + overlay(3) [quarter cells].
     * Count=2 would use half cells for thumbs.
     */

    it('featured img has 3 srcset candidates with w_640, w_1000, w_1400 tokens', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        // The featured img is the first img in the document.
        const imgs = container.querySelectorAll('img');
        const featured = imgs[0] as HTMLElement;

        const entries = parseSrcset(featured);
        expect(entries).toHaveLength(3);

        const widths = entries.map((e) => e.url);
        expect(widths.some((u) => u.includes('w_640'))).toBe(true);
        expect(widths.some((u) => u.includes('w_1000'))).toBe(true);
        expect(widths.some((u) => u.includes('w_1400'))).toBe(true);
    });

    it('featured img srcset descriptors are exactly "640w", "1000w", "1400w"', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const imgs = container.querySelectorAll('img');
        const featured = imgs[0] as HTMLElement;
        const entries = parseSrcset(featured);

        const descriptors = entries.map((e) => e.descriptor);
        expect(descriptors).toContain('640w');
        expect(descriptors).toContain('1000w');
        expect(descriptors).toContain('1400w');
    });

    it('featured img sizes is "(max-width: 640px) 100vw, 66vw"', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const imgs = container.querySelectorAll('img');
        const featured = imgs[0] as HTMLElement;
        expect(featured.getAttribute('sizes')).toBe('(max-width: 640px) 100vw, 66vw');
    });

    it('quarter thumb imgs have 3 srcset candidates with w_200, w_400, w_600 tokens (count>=3)', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        // At count=5: thumbGrid has quarter cells.
        // imgs[0] = featured, imgs[1..2] = regular thumbs, imgs[3] = overlay bg (aria-hidden).
        const imgs = Array.from(container.querySelectorAll('img'));
        // Check the first regular quarter thumb (index 1).
        const quarterThumb = imgs[1] as HTMLElement;

        const entries = parseSrcset(quarterThumb);
        expect(entries).toHaveLength(3);

        const urls = entries.map((e) => e.url);
        expect(urls.some((u) => u.includes('w_200'))).toBe(true);
        expect(urls.some((u) => u.includes('w_400'))).toBe(true);
        expect(urls.some((u) => u.includes('w_600'))).toBe(true);
    });

    it('quarter thumb imgs srcset descriptors are exactly "200w", "400w", "600w"', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const quarterThumb = imgs[1] as HTMLElement;
        const entries = parseSrcset(quarterThumb);

        const descriptors = entries.map((e) => e.descriptor);
        expect(descriptors).toContain('200w');
        expect(descriptors).toContain('400w');
        expect(descriptors).toContain('600w');
    });

    it('quarter thumb sizes is "(max-width: 640px) 50vw, 33vw"', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const quarterThumb = imgs[1] as HTMLElement;
        expect(quarterThumb.getAttribute('sizes')).toBe('(max-width: 640px) 50vw, 33vw');
    });

    it('half thumb img (count=2) has 3 srcset candidates with w_400, w_640, w_900 tokens', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_2}
                variant="detail"
                locale="es"
            />
        );

        // At count=2: thumbGrid has 1 half cell — imgs[1].
        const imgs = Array.from(container.querySelectorAll('img'));
        const halfThumb = imgs[1] as HTMLElement;

        const entries = parseSrcset(halfThumb);
        expect(entries).toHaveLength(3);

        const urls = entries.map((e) => e.url);
        expect(urls.some((u) => u.includes('w_400'))).toBe(true);
        expect(urls.some((u) => u.includes('w_640'))).toBe(true);
        expect(urls.some((u) => u.includes('w_900'))).toBe(true);
    });

    it('half thumb img (count=2) srcset descriptors are exactly "400w", "640w", "900w"', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_2}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const halfThumb = imgs[1] as HTMLElement;
        const entries = parseSrcset(halfThumb);

        const descriptors = entries.map((e) => e.descriptor);
        expect(descriptors).toContain('400w');
        expect(descriptors).toContain('640w');
        expect(descriptors).toContain('900w');
    });

    it('half thumb sizes is "(max-width: 640px) 100vw, 50vw"', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_2}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const halfThumb = imgs[1] as HTMLElement;
        expect(halfThumb.getAttribute('sizes')).toBe('(max-width: 640px) 100vw, 50vw');
    });
});

// ─── 2. cover-plus-grid srcset roles ─────────────────────────────────────────

describe('cover-plus-grid variant — srcset role assignment', () => {
    /**
     * Cover image always uses galleryFeatured (640/1000/1400w).
     * Extras with total<=3 use galleryHalf (400/640/900w).
     * Extras with total>=4 use galleryQuarter (200/400/600w).
     */

    it('cover image (total=5) has featured srcset candidates (w_640, w_1000, w_1400)', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="cover-plus-grid"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const cover = imgs[0] as HTMLElement;
        const entries = parseSrcset(cover);

        expect(entries).toHaveLength(3);
        const urls = entries.map((e) => e.url);
        expect(urls.some((u) => u.includes('w_640'))).toBe(true);
        expect(urls.some((u) => u.includes('w_1000'))).toBe(true);
        expect(urls.some((u) => u.includes('w_1400'))).toBe(true);
    });

    it('extra imgs (total=5, quarter cells) have srcset candidates w_200, w_400, w_600', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="cover-plus-grid"
                locale="es"
            />
        );

        // imgs[0]=cover, imgs[1]=extra1, imgs[2]=extra2, imgs[3]=overlayBg(aria-hidden)
        const imgs = Array.from(container.querySelectorAll('img'));
        const extra = imgs[1] as HTMLElement;
        const entries = parseSrcset(extra);

        expect(entries).toHaveLength(3);
        const urls = entries.map((e) => e.url);
        expect(urls.some((u) => u.includes('w_200'))).toBe(true);
        expect(urls.some((u) => u.includes('w_400'))).toBe(true);
        expect(urls.some((u) => u.includes('w_600'))).toBe(true);
    });

    it('extra imgs (total=2, half cells) have srcset candidates w_400, w_640, w_900', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_2}
                variant="cover-plus-grid"
                locale="es"
            />
        );

        // imgs[0]=cover, imgs[1]=extra1 (half)
        const imgs = Array.from(container.querySelectorAll('img'));
        const halfExtra = imgs[1] as HTMLElement;
        const entries = parseSrcset(halfExtra);

        expect(entries).toHaveLength(3);
        const urls = entries.map((e) => e.url);
        expect(urls.some((u) => u.includes('w_400'))).toBe(true);
        expect(urls.some((u) => u.includes('w_640'))).toBe(true);
        expect(urls.some((u) => u.includes('w_900'))).toBe(true);
    });

    it('extra imgs (total=4, quarter cells) have srcset candidates w_200, w_400, w_600', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_4}
                variant="cover-plus-grid"
                locale="es"
            />
        );

        // imgs[0]=cover(featured), imgs[1..3]=extras(quarter)
        const imgs = Array.from(container.querySelectorAll('img'));
        const quarterExtra = imgs[1] as HTMLElement;
        const entries = parseSrcset(quarterExtra);

        expect(entries).toHaveLength(3);
        const urls = entries.map((e) => e.url);
        expect(urls.some((u) => u.includes('w_200'))).toBe(true);
        expect(urls.some((u) => u.includes('w_400'))).toBe(true);
        expect(urls.some((u) => u.includes('w_600'))).toBe(true);
    });
});

// ─── 3. ar_ token and c_fill in every srcset URL ─────────────────────────────

describe('srcset URLs — c_fill and ar_ token correctness per role', () => {
    /**
     * Per SPEC-186 FR-3 §7, every cell URL must use c_fill and the correct
     * ar_ token for server-side crop to the cell's fixed aspect-ratio.
     *
     * Expected tokens per role:
     *   galleryFeatured: c_fill, ar_16:10
     *   galleryHalf:     c_fill, ar_4:3
     *   galleryQuarter:  c_fill, ar_1:1
     */

    it('galleryFeatured srcset URLs all contain c_fill and ar_16:10', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const featured = imgs[0] as HTMLElement;
        const entries = parseSrcset(featured);

        expect(entries).toHaveLength(3);
        for (const { url } of entries) {
            expect(url).toContain('c_fill');
            expect(url).toContain('ar_16:10');
        }
    });

    it('galleryHalf srcset URLs (count=2, detail) all contain c_fill and ar_4:3', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_2}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const halfThumb = imgs[1] as HTMLElement;
        const entries = parseSrcset(halfThumb);

        expect(entries).toHaveLength(3);
        for (const { url } of entries) {
            expect(url).toContain('c_fill');
            expect(url).toContain('ar_4:3');
        }
    });

    it('galleryQuarter srcset URLs (count=5, detail) all contain c_fill and ar_1:1', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        // imgs[1] is the first regular quarter thumb
        const imgs = Array.from(container.querySelectorAll('img'));
        const quarterThumb = imgs[1] as HTMLElement;
        const entries = parseSrcset(quarterThumb);

        expect(entries).toHaveLength(3);
        for (const { url } of entries) {
            expect(url).toContain('c_fill');
            expect(url).toContain('ar_1:1');
        }
    });

    it('galleryHalf srcset URLs (total=2, cover-plus-grid) all contain c_fill and ar_4:3', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_2}
                variant="cover-plus-grid"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const halfExtra = imgs[1] as HTMLElement;
        const entries = parseSrcset(halfExtra);

        for (const { url } of entries) {
            expect(url).toContain('c_fill');
            expect(url).toContain('ar_4:3');
        }
    });

    it('galleryQuarter srcset URLs (total=4, cover-plus-grid) all contain c_fill and ar_1:1', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_4}
                variant="cover-plus-grid"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const quarterExtra = imgs[1] as HTMLElement;
        const entries = parseSrcset(quarterExtra);

        for (const { url } of entries) {
            expect(url).toContain('c_fill');
            expect(url).toContain('ar_1:1');
        }
    });
});

// ─── 4. Non-Cloudinary URLs: no srcset, no sizes ─────────────────────────────

describe('Non-Cloudinary URLs — NO srcset, NO sizes (guard regression)', () => {
    /**
     * Regression for `isCloudinaryUrl` guard in `buildCellSrcset`.
     *
     * When images have local/external URLs (not res.cloudinary.com), the
     * component MUST NOT emit a srcset or sizes attribute because
     * `getMediaUrl` is a pass-through for non-Cloudinary URLs — all
     * candidates would be identical strings, wasting bandwidth.
     */

    it('featured img from a local URL has no srcset attribute', () => {
        const images = makeLocalImages(5);
        const { container } = render(
            <ImageGallery
                images={images}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const featured = imgs[0] as HTMLElement;
        expect(featured.getAttribute('srcset')).toBeNull();
    });

    it('featured img from a local URL has no sizes attribute', () => {
        const images = makeLocalImages(5);
        const { container } = render(
            <ImageGallery
                images={images}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const featured = imgs[0] as HTMLElement;
        expect(featured.getAttribute('sizes')).toBeNull();
    });

    it('quarter thumb imgs from local URLs have no srcset attribute', () => {
        const images = makeLocalImages(5);
        const { container } = render(
            <ImageGallery
                images={images}
                variant="detail"
                locale="es"
            />
        );

        // imgs[1] is the first thumb (quarter at count=5)
        const imgs = Array.from(container.querySelectorAll('img'));
        const thumb = imgs[1] as HTMLElement;
        expect(thumb.getAttribute('srcset')).toBeNull();
    });

    it('quarter thumb imgs from local URLs have no sizes attribute', () => {
        const images = makeLocalImages(5);
        const { container } = render(
            <ImageGallery
                images={images}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const thumb = imgs[1] as HTMLElement;
        expect(thumb.getAttribute('sizes')).toBeNull();
    });

    it('half thumb img (count=2) from a local URL has no srcset or sizes', () => {
        const images = makeLocalImages(2);
        const { container } = render(
            <ImageGallery
                images={images}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const halfThumb = imgs[1] as HTMLElement;
        expect(halfThumb.getAttribute('srcset')).toBeNull();
        expect(halfThumb.getAttribute('sizes')).toBeNull();
    });

    it('cover-plus-grid cover from local URL has no srcset or sizes', () => {
        const images = makeLocalImages(3);
        const { container } = render(
            <ImageGallery
                images={images}
                variant="cover-plus-grid"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const cover = imgs[0] as HTMLElement;
        expect(cover.getAttribute('srcset')).toBeNull();
        expect(cover.getAttribute('sizes')).toBeNull();
    });

    it('cover-plus-grid extra imgs from local URLs have no srcset or sizes', () => {
        const images = makeLocalImages(3);
        const { container } = render(
            <ImageGallery
                images={images}
                variant="cover-plus-grid"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        // imgs[1] and imgs[2] are extras
        for (const extra of imgs.slice(1)) {
            expect((extra as HTMLElement).getAttribute('srcset')).toBeNull();
            expect((extra as HTMLElement).getAttribute('sizes')).toBeNull();
        }
    });
});

// ─── 5. LCP guard ─────────────────────────────────────────────────────────────

describe('LCP guard — featured img priority attributes and srcset candidate set', () => {
    /**
     * The featured image is the LCP candidate on the accommodation detail page.
     *
     * Requirements (SPEC-186 FR-4 §8 step 10, SPEC-157 REQ-3):
     * 1. loading="eager" — no lazy-load defer.
     * 2. fetchpriority="high" — preload hint to the browser.
     * 3. srcset candidate set is EXACTLY {640w, 1000w, 1400w} — no heavier
     *    candidate bloats the LCP fetch. A future change that adds a wider
     *    candidate (e.g. 2000w) will fail this test intentionally.
     * 4. At a typical 1280px desktop (sizes: 66vw ≈ 845px), the browser
     *    selects the 1000w candidate — identical weight to the pre-srcset
     *    w_1000 baseline. No LCP regression.
     * 5. All other imgs (thumbs) must use loading="lazy".
     */

    it('featured img has loading="eager"', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const featured = imgs[0] as HTMLElement;
        expect(featured.getAttribute('loading')).toBe('eager');
    });

    it('featured img has fetchpriority="high"', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const featured = imgs[0] as HTMLElement;
        expect(featured.getAttribute('fetchpriority')).toBe('high');
    });

    it('featured img srcset contains exactly 3 candidates: 640w, 1000w, 1400w (no heavier candidate)', () => {
        /**
         * This assertion is intentionally strict: if a developer adds a wider
         * candidate (e.g. 2000w) that inflates the LCP payload at typical desktop
         * viewports, this test will catch the regression. The set {640,1000,1400}
         * is the locked contract from SPEC-186 §8 step 10.
         */
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const featured = imgs[0] as HTMLElement;
        const entries = parseSrcset(featured);

        // Exact count — neither fewer nor more candidates.
        expect(entries).toHaveLength(3);

        const pixelWidths = entries.map((e) => descriptorWidth(e.descriptor));
        // Sort for stable comparison regardless of srcset ordering.
        pixelWidths.sort((a, b) => a - b);
        expect(pixelWidths).toEqual([640, 1000, 1400]);
    });

    it('the mid-srcset candidate is 1000w (matches pre-srcset w_1000 LCP baseline)', () => {
        /**
         * At a typical 1280px desktop viewport with sizes="(max-width: 640px)
         * 100vw, 66vw", the effective width is ~845px. The browser selects the
         * closest candidate >= 845px, which is 1000w — the same width as the
         * pre-srcset `w_1000` URL. No LCP regression.
         *
         * We verify this by asserting 1000w is present in the candidate set
         * and that no candidate between 845 and 999px exists (which would have
         * been selected instead, changing the payload).
         */
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const featured = imgs[0] as HTMLElement;
        const entries = parseSrcset(featured);
        const pixelWidths = entries.map((e) => descriptorWidth(e.descriptor));

        expect(pixelWidths).toContain(1000);
        // No candidate in the (845, 999) range that would be selected instead.
        const mid = pixelWidths.filter((w) => w > 845 && w < 1000);
        expect(mid).toHaveLength(0);
    });

    it('all non-featured imgs (thumbs) use loading="lazy"', () => {
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        // imgs[0] = featured (eager); imgs[1..N] = thumbs and overlay bg (all lazy).
        const thumbs = imgs.slice(1);
        expect(thumbs.length).toBeGreaterThan(0);
        for (const thumb of thumbs) {
            expect((thumb as HTMLElement).getAttribute('loading')).toBe('lazy');
        }
    });

    it('featured img srcset URL for 1000w candidate contains w_1000 token', () => {
        /**
         * Directly assert that the 1000w srcset entry carries `w_1000` in its
         * URL so we know Cloudinary receives the correct width parameter.
         */
        const { container } = render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const imgs = Array.from(container.querySelectorAll('img'));
        const featured = imgs[0] as HTMLElement;
        const entries = parseSrcset(featured);
        const w1000Entry = entries.find((e) => e.descriptor === '1000w');
        expect(w1000Entry).toBeDefined();
        expect(w1000Entry?.url).toContain('w_1000');
    });
});

// ─── 6. Lightbox main image — single src, no c_fill / ar_ ────────────────────

describe('Lightbox main image — single src (full preset, uncropped)', () => {
    /**
     * The lightbox uses the 'full' preset (q_auto,f_auto,dpr_auto) — no
     * dimensional crop so the subject is never clipped to a fixed ratio.
     *
     * Assertions:
     * - The lightbox main img has a defined src (not empty).
     * - The src does NOT contain "c_fill" (no crop applied).
     * - The src does NOT contain "ar_" (no aspect-ratio token).
     * - There is NO srcset attribute on the lightbox main img.
     *
     * We identify the lightbox main img by querying inside the dialog and
     * finding the img that carries the component's lightboxImg class name.
     * With the CSS-module identity proxy the class name is literally "lightboxImg".
     */

    it('lightbox main img has no srcset attribute (single src only)', () => {
        render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        // Open the lightbox by clicking the featured button.
        const featuredBtn = screen.getAllByRole('button', { name: /pantalla completa/i })[0];
        fireEvent.click(featuredBtn as HTMLElement);

        const dialog = screen.getByRole('dialog');
        // The lightbox main img uses class "lightboxImg".
        const lightboxMain = dialog.querySelector('.lightboxImg') as HTMLImageElement | null;
        expect(lightboxMain).not.toBeNull();
        expect(lightboxMain?.getAttribute('srcset')).toBeNull();
    });

    it('lightbox main img URL does NOT contain c_fill (full preset, uncropped)', () => {
        render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const featuredBtn = screen.getAllByRole('button', { name: /pantalla completa/i })[0];
        fireEvent.click(featuredBtn as HTMLElement);

        const dialog = screen.getByRole('dialog');
        const lightboxMain = dialog.querySelector('.lightboxImg') as HTMLImageElement | null;
        expect(lightboxMain).not.toBeNull();
        expect(lightboxMain?.getAttribute('src')).not.toContain('c_fill');
    });

    it('lightbox main img URL does NOT contain ar_ (no aspect-ratio crop applied)', () => {
        render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const featuredBtn = screen.getAllByRole('button', { name: /pantalla completa/i })[0];
        fireEvent.click(featuredBtn as HTMLElement);

        const dialog = screen.getByRole('dialog');
        const lightboxMain = dialog.querySelector('.lightboxImg') as HTMLImageElement | null;
        expect(lightboxMain).not.toBeNull();
        expect(lightboxMain?.getAttribute('src')).not.toContain('ar_');
    });

    it('lightbox main img URL contains q_auto (full preset quality token)', () => {
        render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const featuredBtn = screen.getAllByRole('button', { name: /pantalla completa/i })[0];
        fireEvent.click(featuredBtn as HTMLElement);

        const dialog = screen.getByRole('dialog');
        const lightboxMain = dialog.querySelector('.lightboxImg') as HTMLImageElement | null;
        expect(lightboxMain).not.toBeNull();
        expect(lightboxMain?.getAttribute('src')).toContain('q_auto');
    });

    it('lightbox main img src is defined and non-empty', () => {
        render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const featuredBtn = screen.getAllByRole('button', { name: /pantalla completa/i })[0];
        fireEvent.click(featuredBtn as HTMLElement);

        const dialog = screen.getByRole('dialog');
        const lightboxMain = dialog.querySelector('.lightboxImg') as HTMLImageElement | null;
        expect(lightboxMain).not.toBeNull();
        const src = lightboxMain?.getAttribute('src');
        expect(src).toBeTruthy();
        expect(src?.length).toBeGreaterThan(0);
    });

    it('lightbox thumb strip imgs use galleryThumb preset (120px) not full preset', () => {
        /**
         * The lightbox thumbnail strip uses 'galleryThumb' (w_120,ar_1:1,c_fill) —
         * intentionally small to minimize payload. Verify they are NOT using the
         * 'full' preset (which would be much heavier).
         */
        render(
            <ImageGallery
                images={CLD_5}
                variant="detail"
                locale="es"
            />
        );

        const featuredBtn = screen.getAllByRole('button', { name: /pantalla completa/i })[0];
        fireEvent.click(featuredBtn as HTMLElement);

        const dialog = screen.getByRole('dialog');
        // Thumb strip imgs are inside <li> elements.
        const thumbStripImgs = within(dialog)
            .getAllByRole('img')
            .filter((img) => {
                const li = img.closest('li');
                return li !== null;
            });

        // The lightbox strip is rendered when images.length > 1 (5 here).
        expect(thumbStripImgs.length).toBeGreaterThan(0);
        for (const img of thumbStripImgs) {
            const src = img.getAttribute('src') ?? '';
            expect(src).toContain('w_120');
            expect(src).toContain('ar_1:1');
            expect(src).toContain('c_fill');
        }
    });
});
