/**
 * @file accommodation-listing-catalog-via-helper.guard.test.ts
 * @description Static guard for HOS-2057. Every page under
 * `src/pages/[lang]/alojamientos/**` must read the amenity/feature catalog
 * through `lib/filters/accommodation-filter-catalog`, never by calling
 * `amenitiesApi.list` / `featuresApi.list` directly: a raw call brings back the
 * 100-row truncation, the missing vertical scope and the dropped `name` sort.
 *
 * It matches source text, so a catalog read hidden behind another helper is
 * invisible to it. The regex tolerates whitespace and optional chaining between
 * the tokens so formatting variants do not escape it.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../src/pages/[lang]/alojamientos');

/** `amenitiesApi.list(` / `featuresApi . list (` / `amenitiesApi?.list(` and bracket form. */
const RAW_CATALOG_CALL = /\b(?:amenitiesApi|featuresApi)\s*(?:\?\.|\.|\[\s*['"`])\s*list\b/;

/** Recursively lists the `.astro`/`.ts`/`.tsx` files under a directory. */
const listSources = (dir: string): readonly string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return listSources(full);
        return /\.(astro|tsx?)$/.test(entry.name) ? [full] : [];
    });

describe('accommodation listing pages read the catalog through the shared helper', () => {
    const files = listSources(ROOT);

    it('scans a non-empty set of pages', () => {
        expect(files.length).toBeGreaterThan(0);
    });

    it('matches the formatting variants of a raw call', () => {
        expect(RAW_CATALOG_CALL.test('await amenitiesApi.list({})')).toBe(true);
        expect(RAW_CATALOG_CALL.test('featuresApi\n  .list({})')).toBe(true);
        expect(RAW_CATALOG_CALL.test('amenitiesApi?.list()')).toBe(true);
        expect(RAW_CATALOG_CALL.test("featuresApi['list']()")).toBe(true);
        expect(RAW_CATALOG_CALL.test('fetchAccommodationFilterAmenities()')).toBe(false);
    });

    it.each(files.map((f) => [f.slice(ROOT.length)]))('%s has no raw catalog call', (rel) => {
        const source = readFileSync(join(ROOT, rel), 'utf8');
        expect(RAW_CATALOG_CALL.test(source)).toBe(false);
    });
});
