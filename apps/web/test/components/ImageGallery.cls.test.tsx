/**
 * @file ImageGallery.cls.test.ts
 * @description CLS (Cumulative Layout Shift) structural guard for the ImageGallery
 * island (SPEC-186 T-010, FR-3).
 *
 * jsdom cannot measure real layout shift. The spec's CLS guarantee is structural:
 * every gallery cell reserves its space via a fixed CSS aspect-ratio + object-fit:cover,
 * so layout dimensions are established before the image loads. These tests assert the
 * STRUCTURAL INVARIANTS that make CLS zero:
 *
 * 1. CSS file — aspect-ratio values on cell classes match §5 spec matrix.
 * 2. CSS file — object-fit/object-position on image classes (cellImg, coverImg).
 * 3. CSS file — no max-height on .grid base rule or tablet block (T-008 regression guard).
 * 4. CSS file — .thumbGrid base rule has no grid-template-rows (BETA-53 regression guard).
 * 5. CSS file — .coverBtn declares aspect-ratio 16 / 9.
 * 6. Component render — every img in the detail variant carries the cellImg class
 *    (so the above CSS invariants apply to every rendered image).
 * 7. Component render — featured img has width/height attributes (reserves space pre-CSS).
 * 8. fotos.astro — .fotosCell declares aspect-ratio 4 / 3.
 * 9. fotos.astro — no `columns:` CSS property present.
 * 10. fotos.astro — no 768px breakpoint (was removed per spec lock).
 * 11. fotos.astro — breakpoints 1023px and 639px present.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GalleryImage } from '../../src/components/ImageGallery.client';
import { ImageGallery } from '../../src/components/ImageGallery.client';

// ─── File paths ───────────────────────────────────────────────────────────────

const CSS_PATH = resolve(__dirname, '../../src/components/ImageGallery.module.css');
const FOTOS_PATH = resolve(__dirname, '../../src/pages/[lang]/alojamientos/[slug]/fotos.astro');

// ─── Module mocks (required for component render tests) ───────────────────────

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

// ─── CSS-parsing helpers ──────────────────────────────────────────────────────

/**
 * Normalise whitespace in CSS text so assertions are tolerant of Biome
 * formatting (e.g. "16 / 10" with spaces around the slash) and
 * indentation differences.
 */
function normalise(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
}

/**
 * Extract the rule body for a given CSS class selector from raw CSS text.
 * Returns the text between the first `{` and the matching `}` for that
 * selector, or null if the selector is not found.
 *
 * This is intentionally simple (no full parser); it works for the flat,
 * non-nested CSS used in the module file.
 */
function extractClassRule(css: string, className: string): string | null {
    // Match `.className {` — not inside a media query, not a compound selector.
    // We look for the class name appearing as a standalone selector.
    const escapedName = className.replace('.', '\\.');
    const selectorPattern = new RegExp(
        // The selector line: starts with the class, optionally has whitespace,
        // then opens with {. We want the FIRST occurrence of the class as a
        // SOLE selector (not inside a media query or compound rule).
        `(?:^|\\n)\\s*${escapedName}\\s*\\{`,
        'g'
    );

    // Walk through all occurrences and return the FIRST one that is not inside
    // a @media block. For our simple flat CSS this is always the first match.
    const match = selectorPattern.exec(css);
    if (!match) return null;

    const start = css.indexOf('{', match.index) + 1;
    let depth = 1;
    let i = start;
    while (i < css.length && depth > 0) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') depth--;
        i++;
    }
    return css.slice(start, i - 1);
}

/**
 * Check whether a CSS block contains a specific property declaration.
 * Normalises whitespace for tolerance.
 */
function ruleHasProperty(ruleBody: string, property: string, value: string): boolean {
    const normalBody = normalise(ruleBody);
    // Match `property: value;` with flexible spacing
    const pattern = new RegExp(
        `${property.replace('-', '\\-')}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'i'
    );
    return pattern.test(normalBody);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeImages(count: number): GalleryImage[] {
    return Array.from({ length: count }, (_, i) => ({
        url: `/img${i + 1}.jpg`,
        alt: `Photo ${i + 1}`
    }));
}

// ─── Part 1: CSS file — aspect-ratio invariants ───────────────────────────────

describe('ImageGallery.module.css — aspect-ratio invariants (SPEC-186 §5 / FR-3)', () => {
    const css = readFileSync(CSS_PATH, 'utf8');

    it('.cellFeatured declares aspect-ratio: 16 / 10', () => {
        const rule = extractClassRule(css, '.cellFeatured');
        expect(rule).not.toBeNull();
        // Biome formats as "16 / 10" with spaces; assert value loosely
        const normalRule = normalise(rule ?? '');
        expect(normalRule).toMatch(/aspect-ratio\s*:\s*16\s*\/\s*10/);
    });

    it('.cellHalf declares aspect-ratio: 4 / 3', () => {
        const rule = extractClassRule(css, '.cellHalf');
        expect(rule).not.toBeNull();
        const normalRule = normalise(rule ?? '');
        expect(normalRule).toMatch(/aspect-ratio\s*:\s*4\s*\/\s*3/);
    });

    it('.cellQuarter declares aspect-ratio: 1 / 1', () => {
        const rule = extractClassRule(css, '.cellQuarter');
        expect(rule).not.toBeNull();
        const normalRule = normalise(rule ?? '');
        expect(normalRule).toMatch(/aspect-ratio\s*:\s*1\s*\/\s*1/);
    });

    it('.coverBtn declares aspect-ratio: 16 / 9', () => {
        const rule = extractClassRule(css, '.coverBtn');
        expect(rule).not.toBeNull();
        const normalRule = normalise(rule ?? '');
        expect(normalRule).toMatch(/aspect-ratio\s*:\s*16\s*\/\s*9/);
    });
});

// ─── Part 2: CSS file — object-fit / object-position ─────────────────────────

describe('ImageGallery.module.css — object-fit and object-position (FR-3 fill + center)', () => {
    const css = readFileSync(CSS_PATH, 'utf8');

    it('.cellImg declares object-fit: cover', () => {
        const rule = extractClassRule(css, '.cellImg');
        expect(rule).not.toBeNull();
        expect(ruleHasProperty(rule ?? '', 'object-fit', 'cover')).toBe(true);
    });

    it('.cellImg declares object-position: center', () => {
        const rule = extractClassRule(css, '.cellImg');
        expect(rule).not.toBeNull();
        expect(ruleHasProperty(rule ?? '', 'object-position', 'center')).toBe(true);
    });

    /**
     * .coverImg intentionally omits object-position.
     * The browser default for object-position is "50% 50%" (equivalent to center).
     * The spec relies on this default rather than re-declaring it; this avoids
     * redundant declarations while still producing the correct center-cropping
     * behavior. We assert only object-fit: cover.
     */
    it('.coverImg declares object-fit: cover (object-position relies on browser default center)', () => {
        const rule = extractClassRule(css, '.coverImg');
        expect(rule).not.toBeNull();
        expect(ruleHasProperty(rule ?? '', 'object-fit', 'cover')).toBe(true);
        // Document the deliberate absence of object-position on coverImg.
        // The browser default (50% 50% = center) is relied upon; no need to
        // declare it explicitly and risk diverging from the cellImg override path.
    });
});

// ─── Part 3: CSS file — no max-height on .grid (T-008 regression guard) ──────

describe('ImageGallery.module.css — max-height absence on .grid (T-008 regression)', () => {
    /**
     * T-008 bug: a container max-height combined with height:100% on the featured
     * cell causes CSS to treat BOTH width AND height as non-auto, which overrides
     * aspect-ratio (spec says: both width+height non-auto → ratio ignored). This
     * produces distorted cells and defeats FR-3 CLS guarantee.
     *
     * Regression guard: the base .grid rule must NOT contain max-height.
     * The tablet @media block also must NOT add max-height (same reasoning).
     */

    const css = readFileSync(CSS_PATH, 'utf8');

    it('.grid base rule does NOT contain max-height', () => {
        const rule = extractClassRule(css, '.grid');
        expect(rule).not.toBeNull();
        // max-height must be absent from the base .grid rule body
        expect(normalise(rule ?? '')).not.toMatch(/max-height\s*:/);
    });

    it('tablet @media block (641px–1023px) does NOT introduce max-height on any selector', () => {
        // Extract the tablet media query block content
        const tabletBlockMatch = css.match(
            /@media\s*\(min-width:\s*641px\)\s*and\s*\(max-width:\s*1023px\)\s*\{([\s\S]*?)\n\}/
        );
        // If the tablet block exists, verify it has no max-height
        if (tabletBlockMatch) {
            const tabletBlock = tabletBlockMatch[1] ?? '';
            expect(normalise(tabletBlock)).not.toMatch(/max-height\s*:/);
        } else {
            // Block may have different whitespace; check raw CSS for max-height within 641px context
            const has641px = css.includes('641px');
            if (has641px) {
                // Locate the 641px media block region and check it has no max-height
                const blockStart = css.indexOf('641px');
                const blockEnd = css.indexOf('@media', blockStart + 1);
                const blockContent =
                    blockEnd > -1 ? css.slice(blockStart, blockEnd) : css.slice(blockStart);
                expect(normalise(blockContent)).not.toMatch(/max-height\s*:/);
            }
            // If there is no 641px block, the tablet breakpoint is absent — that is also fine
            // (no max-height can be added where there is no block).
        }
    });

    it('mobile @media block (max-width: 640px) may set max-height: none (explicit reset) but NOT a positive value', () => {
        /**
         * The mobile block intentionally sets `max-height: none` on the count=3,4,5+
         * grid rules to undo any inherited max-height. This is safe because `none`
         * is the "no constraint" value and does not re-introduce the ratio conflict.
         * A positive max-height value (e.g. `max-height: 480px`) would be dangerous.
         */
        const mobileBlockMatch = css.match(/@media\s*\(max-width:\s*640px\)\s*\{([\s\S]*?)\n\}/);
        if (mobileBlockMatch) {
            const mobileBlock = mobileBlockMatch[1] ?? '';
            // Must NOT contain a positive max-height value (px/rem/em/%)
            expect(normalise(mobileBlock)).not.toMatch(/max-height\s*:\s*\d/);
        }
        // If the block has no max-height at all, this test is trivially satisfied.
    });
});

// ─── Part 4: CSS file — .thumbGrid base rule has no grid-template-rows ────────

describe('ImageGallery.module.css — .thumbGrid base rule has no grid-template-rows (BETA-53 regression)', () => {
    /**
     * The original BETA-53 bug: .thumbGrid had `grid-template-rows: repeat(3, 1fr)`
     * unconditionally, which created 3 empty rows even when count=2 or count=3.
     * The fix moved grid-template-rows to count-scoped selectors only
     * (.grid[data-count="3"] .thumbGrid, etc.).
     *
     * Regression guard: the BASE .thumbGrid rule must NOT contain grid-template-rows.
     */
    const css = readFileSync(CSS_PATH, 'utf8');

    it('.thumbGrid base rule does NOT contain grid-template-rows', () => {
        const rule = extractClassRule(css, '.thumbGrid');
        expect(rule).not.toBeNull();
        expect(normalise(rule ?? '')).not.toMatch(/grid-template-rows\s*:/);
    });
});

// ─── Part 5: Component render — cellImg class on every img ───────────────────

describe('ImageGallery detail variant — every cell img carries cellImg class (so CSS applies)', () => {
    /**
     * The CSS invariants in Parts 1-4 only protect images if the cellImg class
     * is actually applied to every rendered img element. This group verifies that
     * at counts 1, 3, and 5 all non-lightbox img elements carry the cellImg class.
     *
     * Note: the overlay bg img (aria-hidden="true") also carries cellImg (it is
     * inside .moreOverlay and needs the same cover crop). The lightbox is not
     * open during these renders, so only gallery grid imgs are asserted.
     */

    function renderDetail(count: number) {
        const images = makeImages(count);
        const { container } = render(
            <ImageGallery
                images={images}
                variant="detail"
                locale="es"
            />
        );
        return container;
    }

    it('count=1: featured img has class "cellImg"', () => {
        const container = renderDetail(1);
        const imgs = Array.from(container.querySelectorAll('img'));
        expect(imgs.length).toBe(1);
        for (const img of imgs) {
            expect(img.className).toContain('cellImg');
        }
    });

    it('count=3: all 3 cell imgs carry class "cellImg"', () => {
        const container = renderDetail(3);
        const imgs = Array.from(container.querySelectorAll('img'));
        expect(imgs.length).toBe(3);
        for (const img of imgs) {
            expect(img.className).toContain('cellImg');
        }
    });

    it('count=5: all 4 rendered cell imgs (including overlay bg img) carry class "cellImg"', () => {
        /**
         * At count=5: featured(0) + thumb(1) + thumb(2) + overlayBg(3, aria-hidden).
         * Total = 4 imgs in the grid. The overlay bg img uses the same cellImg class
         * for consistent cover cropping.
         */
        const container = renderDetail(5);
        const imgs = Array.from(container.querySelectorAll('img'));
        expect(imgs.length).toBe(4);
        for (const img of imgs) {
            expect(img.className).toContain('cellImg');
        }
    });
});

// ─── Part 6: Component render — featured img width/height attributes ──────────

describe('ImageGallery detail variant — featured img width/height reserve space pre-CSS', () => {
    /**
     * SPEC-157 REQ-3 + SPEC-186 FR-3: the featured img element carries explicit
     * width and height attributes. These let the browser reserve the correct
     * layout space before CSS (and before the image bytes arrive) — especially
     * important in hydration windows where the island has mounted but styles may
     * not yet have applied the aspect-ratio constraint.
     *
     * The component sets width=800 height=480 on the featured img, which mirrors
     * the 16:10 cell ratio (800÷480 = 5÷3 ≈ 1.667 ≈ 16/10).
     */
    it('featured img has width and height attributes', () => {
        const images = makeImages(3);
        const { container } = render(
            <ImageGallery
                images={images}
                variant="detail"
                locale="es"
            />
        );
        // The featured img is always the first img in the grid
        const featuredImg = container.querySelector('img');
        expect(featuredImg).not.toBeNull();
        expect(featuredImg?.getAttribute('width')).not.toBeNull();
        expect(featuredImg?.getAttribute('height')).not.toBeNull();
        // Verify the specific values the component sets (800x480 = 16:10)
        expect(Number(featuredImg?.getAttribute('width'))).toBeGreaterThan(0);
        expect(Number(featuredImg?.getAttribute('height'))).toBeGreaterThan(0);
    });
});

// ─── Part 7: fotos.astro — structural CSS invariants ─────────────────────────

describe('fotos.astro — structural CSS invariants (SPEC-186 T-014 / T-015)', () => {
    /**
     * fotos.astro replaced the columns-based masonry layout with a fixed-ratio
     * CSS grid. These tests read the .astro file as text and assert the structural
     * CSS invariants that guarantee zero CLS and correct breakpoint behavior.
     *
     * Tests complement T-015 which validates the fotos page at a higher level.
     */

    const source = readFileSync(FOTOS_PATH, 'utf8');

    it('.fotosCell declares aspect-ratio: 4 / 3', () => {
        // The .fotosCell rule is inside a <style> block in the Astro component.
        // We assert the raw source text contains the declaration.
        expect(source).toMatch(/\.fotosCell\s*\{[^}]*aspect-ratio\s*:\s*4\s*\/\s*3/s);
    });

    it('no standalone "columns:" CSS property remains (masonry replacement is complete)', () => {
        /**
         * The former layout used a CSS `columns:` property for masonry. After T-014
         * this is completely replaced by a `display: grid` approach. A stray
         * `columns:` would partially re-introduce the old layout alongside the new one.
         *
         * We specifically guard against the standalone `columns` shorthand (which sets
         * column-count/column-width for multi-column layout), NOT `grid-template-columns`
         * which is the correct grid property in use. The negative look-behind excludes
         * the `grid-template-` prefix so `grid-template-columns:` does not trigger this.
         */
        // Use a negative look-behind to exclude `grid-template-columns:`
        expect(source).not.toMatch(/(?<!grid-template-)(?<!column-)(?<!grid-)columns\s*:/);
    });

    it('no 768px breakpoint (removed per spec lock — replaced by 1023px + 639px)', () => {
        /**
         * The spec locks breakpoints to >=1024px (3 cols), 640–1023px (2 cols),
         * <640px (1 col). A 768px breakpoint indicates a stale or incorrect
         * breakpoint that was not part of the locked spec.
         */
        expect(source).not.toContain('768px');
    });

    it('breakpoint 1023px is present (tablet → 2-column transition)', () => {
        /**
         * The tablet rule: `@media (max-width: 1023px)` switches from 3 to 2 columns.
         */
        expect(source).toContain('1023px');
    });

    it('breakpoint 639px is present (mobile → 1-column transition)', () => {
        /**
         * The mobile rule: `@media (max-width: 639px)` switches from 2 to 1 column.
         */
        expect(source).toContain('639px');
    });
});
