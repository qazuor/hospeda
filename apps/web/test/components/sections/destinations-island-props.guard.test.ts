/**
 * @file destinations-island-props.guard.test.ts
 * @description Guards the narrowed prop payload of the homepage destinations
 * island (HOS-369 W3-3).
 *
 * Astro serializes an island's props into the HTML so the client can hydrate,
 * so every field handed to `<DestinationsIsland>` is paid for in the document
 * whether or not anything renders it. Passing the full `DestinationCardData`
 * shipped `gallery` alone at 77,162 B across the 22 destinations — 63.7% of the
 * island's props and 15% of the whole home page — plus `coordinates`,
 * `ratingDimensions`, `isFeatured` and `eventsCount`, none of which the island
 * or `DestinationsMap` read.
 *
 * TypeScript does NOT cover this on its own: excess-property checking applies
 * to object literals, and a spread (`{ ...dest }`) assigned to the narrow type
 * passes silently. Hence a guard.
 *
 * What this guard does NOT cover: whether the island still *renders* correctly
 * with the narrowed set. That is a rendering concern, verified in the browser,
 * not something a source scan can assert.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SECTION = resolve(__dirname, '../../../src/components/sections/DestinationsSection.astro');
const ISLAND = resolve(__dirname, '../../../src/components/sections/DestinationsIsland.client.tsx');

const sectionSrc = readFileSync(SECTION, 'utf8');
const islandSrc = readFileSync(ISLAND, 'utf8');

/** Fields measured as pure payload — read nowhere in the island's tree. */
const UNREAD_FIELDS = [
    'gallery',
    'coordinates',
    'ratingDimensions',
    'isFeatured',
    'eventsCount'
] as const;

/**
 * Strips comments so a field NAMED in the rationale prose is not mistaken for
 * the field being PASSED. A W3-6-era guard produced exactly that false positive
 * by matching the comment explaining why a call was absent.
 */
function code(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('DestinationsIsland prop payload (HOS-369 W3-3)', () => {
    it('hands the island the narrowed projection, not the full card data', () => {
        const body = code(sectionSrc);
        expect(body).toMatch(/destinations=\{islandDestinations\}/);
        expect(body).not.toMatch(/destinations=\{optimizedDestinations\}/);
    });

    it('types the projection so a renamed upstream field fails the build', () => {
        expect(code(sectionSrc)).toMatch(/const islandDestinations:\s*DestinationsIslandData\[\]/);
    });

    it('never projects a field the island tree does not read', () => {
        // Only the projection body — the rest of the file legitimately reads
        // `dest.featuredImage` and friends while optimizing images.
        const projection = code(sectionSrc).split('const islandDestinations')[1]?.split('}));')[0];
        expect(projection, 'projection block not found — did it get renamed?').toBeTruthy();
        for (const field of UNREAD_FIELDS) {
            expect(
                projection,
                `"${field}" is serialized into the HTML but read nowhere`
            ).not.toContain(`${field}:`);
        }
    });

    it('declares the island payload as a Pick, not a hand-written interface', () => {
        // A Pick fails the typecheck when an upstream field is renamed; a
        // duplicated interface silently drifts and yields `undefined` at runtime.
        expect(code(islandSrc)).toMatch(
            /export type DestinationsIslandData = Pick<\s*DestinationCardData,/
        );
    });

    it('keeps every field the island actually renders', () => {
        // Non-vacuity: proves the projection is a real narrowing, not an empty
        // block that would pass the exclusion test above for the wrong reason.
        const projection =
            code(sectionSrc).split('const islandDestinations')[1]?.split('}));')[0] ?? '';
        for (const field of ['id', 'slug', 'name', 'summary', 'featuredImage', 'attractions']) {
            expect(projection).toContain(`${field}:`);
        }
    });
});
