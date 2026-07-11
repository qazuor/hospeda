/**
 * @file publicaciones-sidebar-categories-id.test.ts
 * @description HOS-96 T-015 — blog has NO dedicated `blog-filter-groups.ts`;
 * its `filterGroups` are declared INLINE in `publicaciones/index.astro`. This
 * verifies the inline `category` checkbox group's id is renamed to
 * `categories` AND that the page seeds `sidebarInitialParams` under the new
 * key from `postCategoryActiveValues` (the URL-init round-trip —
 * `FilterSidebar.client.tsx` seeds its initial state exclusively from the
 * `initialParams` prop, never from `window.location.search` directly).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/index.astro'),
    'utf8'
);

describe('publicaciones/index.astro — inline filterGroups category id + sidebar round-trip (HOS-96 T-015)', () => {
    it('renames the inline category checkbox group id to "categories" (not the old singular "category")', () => {
        const filterGroupsBlock = src.slice(
            src.indexOf('const filterGroups = ['),
            src.indexOf('const sortOptions = [')
        );
        expect(filterGroupsBlock).toContain("id: 'categories'");
        expect(filterGroupsBlock).not.toContain("id: 'category'");
    });

    it('seeds sidebarInitialParams under the "categories" key (not the old "category" key)', () => {
        expect(src).toContain("sidebarInitialParams['categories']");
        expect(src).not.toContain("sidebarInitialParams['category']");
    });

    it('seeds the categories key from postCategoryActiveValues (the same array already computed for the API fetch)', () => {
        expect(src).toMatch(
            /sidebarInitialParams\['categories'\]\s*=\s*postCategoryActiveValues\.join\(','\)/
        );
    });

    it('only writes sidebarInitialParams.categories when there is at least one active value', () => {
        expect(src).toMatch(
            /if\s*\(postCategoryActiveValues\.length\s*>\s*0\)\s*sidebarInitialParams\['categories'\]/
        );
    });
});
