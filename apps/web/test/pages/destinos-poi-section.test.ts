/**
 * @file destinos-poi-section.test.ts
 * @description Integration/wiring test for HOS-113 Phase 4 (extended
 * HOS-146): the destination detail page (`[...path].astro`, T-049) renders
 * the POI list/grid section AND the POI map, both sourced from the same
 * transformed `dest.pointsOfInterest` relation (T-051 — the cross-component
 * acceptance test for AC-5).
 *
 * Astro components cannot be rendered in Vitest (no DOM renderer for
 * `.astro` — see `apps/web/CLAUDE.md` Testing section), so this suite
 * asserts against source text:
 *   - `[...path].astro` runs `dest.pointsOfInterest` through
 *     `toDestinationPointOfInterestListProps` (HOS-146: no raw API data in
 *     component props, per the transform rule in apps/web/CLAUDE.md) and
 *     wires the SAME transformed array into both `<DestinationPOISection>`
 *     (page BODY, not the header slot, unlike attractions — §6.4) and
 *     `<DestinationPOIMap>`, passed through untouched so an empty array
 *     (no-POI destination) renders no section/map at all —
 *     `DestinationPOISection.astro`'s own empty-guard is exercised in
 *     `test/components/destination/DestinationPOISection.test.ts` (T-048),
 *     and `DestinationPOIMap`'s in `test/components/destination/DestinationPOIMap.test.tsx`.
 *
 * Per-locale (es/en/pt) translation CORRECTNESS for POI display names and
 * type labels (AC-7) is verified end to end against the real locale data in
 * `test/lib/poi-labels.test.ts` — not duplicated here.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../src');

const pageSrc = readFileSync(resolve(SRC_DIR, 'pages/[lang]/destinos/[...path].astro'), 'utf8');

/**
 * Extracts the source of a single component tag, anchored between its opening
 * `<Name` and the `/>` that closes it.
 *
 * Asserting on a whole-file substring is not enough for "both components get
 * the same prop": `expect(pageSrc).toContain('pointsOfInterest={pointsOfInterest}')`
 * is already satisfied by the grid's tag alone, so it passes even if the map is
 * wired to a different variable entirely. Slicing each tag's own region is what
 * makes the assertion mean what it says.
 */
function tagSource(tagName: string): string {
    const start = pageSrc.indexOf(`<${tagName}`);
    if (start === -1) throw new Error(`<${tagName}> not found in the page source`);
    const end = pageSrc.indexOf('/>', start);
    if (end === -1) throw new Error(`<${tagName}> is not self-closing`);
    return pageSrc.slice(start, end + 2);
}

describe('destinos/[...path].astro — POI section + map wiring (HOS-113 T-049/T-051, HOS-146)', () => {
    it('imports DestinationPOISection', () => {
        expect(pageSrc).toContain(
            "import DestinationPOISection from '@/components/destination/DestinationPOISection.astro';"
        );
    });

    it('imports DestinationPOIMap (HOS-146)', () => {
        expect(pageSrc).toContain(
            "import { DestinationPOIMap } from '@/components/destination/DestinationPOIMap.client';"
        );
    });

    it('imports toDestinationPointOfInterestListProps and never passes raw API data to components (HOS-146)', () => {
        expect(pageSrc).toContain('toDestinationPointOfInterestListProps');
        expect(pageSrc).toContain(
            'const pointsOfInterest = toDestinationPointOfInterestListProps({'
        );
    });

    it('passes the SAME transformed pointsOfInterest array to both the grid and the map (single source, no divergence)', () => {
        // Each tag is asserted inside its OWN region, so wiring the map to a
        // different variable fails here instead of passing on the grid's match.
        const gridTag = tagSource('DestinationPOISection');
        const mapTag = tagSource('DestinationPOIMap');

        expect(gridTag).toContain('pointsOfInterest={pointsOfInterest}');
        expect(mapTag).toContain('pointsOfInterest={pointsOfInterest}');
        expect(gridTag).toContain('locale={locale}');
        expect(mapTag).toContain('locale={locale}');
    });

    it('passes destinationId to the map so it can fetch the NEARBY POIs the payload omits (HOS-146)', () => {
        // The detail payload is PRIMARY-only (DestinationService._withPointsOfInterest);
        // the map pulls NEARBY from /destinations/:id/points-of-interest itself.
        expect(tagSource('DestinationPOIMap')).toContain('destinationId={destId}');
    });

    it('passes the destination centre to the map, not the POI bbox (HOS-146 framing)', () => {
        expect(tagSource('DestinationPOIMap')).toContain('center={poiMapCenter}');
    });

    it('mounts DestinationPOIMap client:only="react" (Leaflet needs window)', () => {
        expect(tagSource('DestinationPOIMap')).toContain('client:only="react"');
    });

    it('reserves the map wrapper height so the client:only island does not shift the page on hydration', () => {
        // client:only emits no SSR HTML: without a reserved height the wrapper is
        // 0px until Leaflet mounts, then jumps to LocationMap.module.css's 560px.
        expect(pageSrc).toContain('dest-detail__poi-map');
        expect(pageSrc).toMatch(/\.dest-detail__poi-map\s*\{[^}]*min-height:\s*560px/);
    });

    // The reservation above and the gate below are a PAIR — asserting the 560px
    // alone is what let a 592px hole ship on 6 of 26 production destinations
    // with CI green. A height-reserving wrapper is only correct while the thing
    // it reserves for actually renders.
    it('gates the height-reserving map wrapper server-side, so a POI-less destination gets no empty hole', () => {
        // DestinationPOIMap returns null when no POI has coordinates, but the
        // wrapper's 560px min-height + 2rem margin do not care: ungated, that is
        // ~592px of blank page on every destination with no geolocated POI
        // (argentina, litoral-argentino, entre-rios, departamento-uruguay,
        // pueblo-liebig, villa-paranacito — all PUBLIC). Same shape as the
        // `hasDestCoords &&` gate on <DestinationMiniMap> below it.
        expect(pageSrc).toMatch(
            /\{\s*hasGeolocatedPois\s*&&\s*\(\s*<div class="dest-detail__section dest-detail__poi-map">/
        );
    });

    it('derives that gate from the SAME predicate the island guards on (≥1 POI with coordinates)', () => {
        // If these two drift, the bug comes back in one direction or the other:
        // a wrapper with no island (hole), or an island with no wrapper (CLS).
        expect(pageSrc).toMatch(
            /const hasGeolocatedPois\s*=\s*pointsOfInterest\.some\(\s*\(poi\)\s*=>\s*poi\.lat\s*!=\s*null\s*&&\s*poi\.long\s*!=\s*null\s*\)/
        );
    });

    it('leaves the SSR grid ungated — it self-guards and reserves no height (only the map needs the gate)', () => {
        const gridWrapper = pageSrc.slice(
            pageSrc.lastIndexOf('<div', pageSrc.indexOf('<DestinationPOISection')),
            pageSrc.indexOf('<DestinationPOISection')
        );
        expect(gridWrapper).toContain('class="dest-detail__section"');
        expect(gridWrapper).not.toContain('dest-detail__poi-map');
    });

    it('renders the POI section in the page BODY, not the header slot (unlike attractions)', () => {
        const headerBlockStart = pageSrc.indexOf('<DestinationDetailHeader');
        const headerBlockEnd = pageSrc.indexOf('</Fragment>', headerBlockStart);
        const poiIndex = pageSrc.indexOf('<DestinationPOISection');
        expect(poiIndex).toBeGreaterThan(headerBlockEnd);
    });

    it('renders the POI map after the POI grid', () => {
        const gridIndex = pageSrc.indexOf('<DestinationPOISection');
        const mapIndex = pageSrc.indexOf('<DestinationPOIMap');
        expect(mapIndex).toBeGreaterThan(gridIndex);
    });

    it('defaults pointsOfInterest to an empty array when the API omits the relation (never crashes on undefined)', () => {
        expect(pageSrc).toMatch(
            /pointsOfInterest:\s*\(dest\.pointsOfInterest as ReadonlyArray<Record<string, unknown>>\)\s*\?\?\s*\[\]/
        );
    });
});
