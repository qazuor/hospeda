/**
 * @file alojamientos-slug-compare-bar.test.ts
 * @description HOS-85 post-review fix — the accommodation detail page
 * (`[lang]/alojamientos/[slug].astro`) must mount the floating `CompareBar`
 * island directly, NOT via `DetailLayout` (which is shared by destination,
 * event, post, and attraction detail pages that have nothing to do with
 * accommodation comparison).
 *
 * Astro pages/components cannot be rendered through Vitest/jsdom, so this
 * follows the project's established pattern (see
 * `apps/web/test/pages/alojamientos-fotos-gallery.test.ts`) of asserting on
 * the raw source text.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SLUG_PAGE_PATH = resolve(__dirname, '../../src/pages/[lang]/alojamientos/[slug].astro');
const DETAIL_LAYOUT_PATH = resolve(__dirname, '../../src/layouts/DetailLayout.astro');

const slugPageSrc = readFileSync(SLUG_PAGE_PATH, 'utf8');
const detailLayoutSrc = readFileSync(DETAIL_LAYOUT_PATH, 'utf8');

describe('[slug].astro — CompareBar mount (HOS-85 post-review fix)', () => {
    it('imports CompareBar from the shared compare island', () => {
        expect(slugPageSrc).toMatch(
            /import\s*\{\s*CompareBar\s*\}\s*from\s*['"]@\/components\/shared\/compare\/CompareBar\.client['"]/
        );
    });

    it('mounts <CompareBar with client:idle hydration', () => {
        // Same hydration strategy ListingLayout uses for the same island.
        expect(slugPageSrc).toMatch(/<CompareBar\s+locale=\{locale\}\s+client:idle\s*\/>/);
    });

    it('passes the page locale to CompareBar', () => {
        expect(slugPageSrc).toContain('<CompareBar locale={locale} client:idle />');
    });

    it('mounts CompareBar inside <DetailLayout>...</DetailLayout>, not before/after it', () => {
        const layoutOpenIndex = slugPageSrc.indexOf('<DetailLayout');
        const layoutCloseIndex = slugPageSrc.indexOf('</DetailLayout>');
        const compareBarIndex = slugPageSrc.indexOf('<CompareBar locale={locale} client:idle />');

        expect(layoutOpenIndex).toBeGreaterThan(-1);
        expect(layoutCloseIndex).toBeGreaterThan(-1);
        expect(compareBarIndex).toBeGreaterThan(layoutOpenIndex);
        expect(compareBarIndex).toBeLessThan(layoutCloseIndex);
    });

    it('does NOT mount CompareBar inside the sidebar slot', () => {
        // The sidebar Fragment must open AFTER the CompareBar mount, so
        // CompareBar lands in the default slot (harmless either way since it
        // is fixed-position, but the sidebar isn't rendered on narrow
        // viewports the same way the main slot is — keep it out of there).
        const compareBarIndex = slugPageSrc.indexOf('<CompareBar locale={locale} client:idle />');
        const sidebarFragmentIndex = slugPageSrc.indexOf('<Fragment slot="sidebar">');

        expect(compareBarIndex).toBeGreaterThan(-1);
        expect(sidebarFragmentIndex).toBeGreaterThan(-1);
        expect(compareBarIndex).toBeLessThan(sidebarFragmentIndex);
    });
});

describe('DetailLayout.astro — does NOT itself mount CompareBar', () => {
    it('has no CompareBar import or usage (accommodation-only concern, not shared-layout)', () => {
        // DetailLayout is shared by destination/event/post/attraction detail
        // pages (see its file-header doc comment) — comparison is
        // accommodation-only, so it must be mounted per-page, not here.
        expect(detailLayoutSrc).not.toContain('CompareBar');
    });
});
