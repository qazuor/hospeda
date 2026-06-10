/**
 * @file ListingLayout.test.ts
 * @description Source-based tests for ListingLayout.astro (Astro components
 * cannot be rendered in Vitest, so we assert on the component source — the
 * project's documented approach for .astro coverage).
 *
 * SPEC-157 follow-up:
 *  - ListingLayout must expose a `noindex` prop and forward it to SEOHead so
 *    facet/filter sub-pages can opt into `noindex,follow`.
 *  - Mirrors DefaultLayout's existing `noindex` handling.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LAYOUTS_DIR = resolve(__dirname, '../../src/layouts');
const src = readFileSync(resolve(LAYOUTS_DIR, 'ListingLayout.astro'), 'utf8');

describe('ListingLayout.astro (noindex support)', () => {
    it('declares a readonly noindex prop defaulting to false', () => {
        expect(src).toContain('readonly noindex?: boolean');
        expect(src).toContain('noindex = false');
    });

    it('forwards noindex to SEOHead', () => {
        expect(src).toContain('noindex={noindex}');
    });

    it('mirrors DefaultLayout, which already forwards noindex to SEOHead', () => {
        const defaultLayoutSrc = readFileSync(resolve(LAYOUTS_DIR, 'DefaultLayout.astro'), 'utf8');
        expect(defaultLayoutSrc).toContain('readonly noindex?: boolean');
        expect(defaultLayoutSrc).toContain('noindex={noindex}');
    });
});
