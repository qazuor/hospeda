/**
 * @file alojamientos-comodidades-slug.test.ts
 * @description Source-level regression test for
 * `alojamientos/comodidades/[slug]/index.astro`.
 *
 * The amenity landing page resolved the amenity from the slug but then listed
 * EVERY accommodation, because the `amenities` filter was left out of the
 * listing call behind a TODO. Its sibling `caracteristicas/[slug]` page has
 * always passed `features`. The listing API's `amenities` filter was measured
 * against production (wood_stove: 1 accommodation via the filter, 1 link in
 * `r_accommodation_amenity`, 6 accommodations unfiltered).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/alojamientos/comodidades/[slug]/index.astro'),
    'utf8'
);

describe('alojamientos/comodidades/[slug]/index.astro', () => {
    it('filters the accommodation listing by the resolved amenity id', () => {
        expect(pageSource).toMatch(/accommodationsApi\.list\(\{\s*amenities:\s*amenityId\s*,/);
    });

    it('carries no leftover TODO about the amenity filter', () => {
        expect(pageSource).not.toContain('Pass amenities=[amenityId]');
    });
});
