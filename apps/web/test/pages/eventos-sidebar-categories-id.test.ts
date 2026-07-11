/**
 * @file eventos-sidebar-categories-id.test.ts
 * @description HOS-96 T-014 — verifies the events page seeds the renamed
 * sidebar `categories` FilterGroup from the `categories` URL param (the
 * URL-init round-trip). `FilterSidebar.client.tsx` does NOT read
 * `window.location.search` itself — it seeds its initial reducer state
 * exclusively from the `initialParams` PROP the page passes in
 * (`initStateFromParams({ ..., params: initialParams ?? {} })`). Renaming
 * only the `FilterGroup.id` (T-014's `events-filter-groups.ts` change) would
 * therefore desync the sidebar from the URL unless the page ALSO seeds
 * `sidebarInitialParams['categories']` (not the old `'category'` key) — this
 * is that fix, reusing `activeCategories` already computed for T-013's fetch.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/eventos/index.astro'), 'utf8');

describe('eventos/index.astro — sidebar categories group id round-trip (HOS-96 T-014)', () => {
    it('seeds sidebarInitialParams under the "categories" key (not the old "category" key)', () => {
        expect(src).toContain("sidebarInitialParams['categories']");
        expect(src).not.toContain("sidebarInitialParams['category']");
    });

    it('seeds the categories key from activeCategories (the same array already computed for the API fetch), not the singular category', () => {
        expect(src).toMatch(
            /sidebarInitialParams\['categories'\]\s*=\s*activeCategories\.join\(','\)/
        );
    });

    it('only writes sidebarInitialParams.categories when there is at least one active value (guards against an empty ?categories= param)', () => {
        expect(src).toMatch(
            /if\s*\(activeCategories\.length\s*>\s*0\)\s*sidebarInitialParams\['categories'\]/
        );
    });
});
