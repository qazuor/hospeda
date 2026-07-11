/**
 * @file destinos-poi-section.test.ts
 * @description Integration/wiring test for HOS-113 Phase 4: the destination
 * detail page (`[...path].astro`, T-049) renders the POI list/grid section
 * sourced from the hydrated `dest.pointsOfInterest` relation (T-051 — the
 * cross-component acceptance test for AC-5).
 *
 * Astro components cannot be rendered in Vitest (no DOM renderer for
 * `.astro` — see `apps/web/CLAUDE.md` Testing section), so this suite
 * asserts against source text:
 *   - `[...path].astro` casts `dest.pointsOfInterest` and wires
 *     `<DestinationPOISection>` into the page BODY (not the header slot,
 *     unlike attractions — §6.4), passing it straight through untouched so
 *     an empty array (no-POI destination) renders no section at all —
 *     `DestinationPOISection.astro`'s own empty-guard is exercised in
 *     `test/components/destination/DestinationPOISection.test.ts` (T-048).
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

describe('destinos/[...path].astro — POI section wiring (HOS-113 T-049/T-051)', () => {
    it('imports DestinationPOISection', () => {
        expect(pageSrc).toContain(
            "import DestinationPOISection from '@/components/destination/DestinationPOISection.astro';"
        );
    });

    it('casts dest.pointsOfInterest (hydrated by DestinationService._withPointsOfInterest)', () => {
        expect(pageSrc).toContain('const pointsOfInterest = (dest.pointsOfInterest as');
    });

    it('passes the pointsOfInterest array through unmodified (no truthy-guard around the tag — the component owns the empty-render decision)', () => {
        expect(pageSrc).toContain(
            '<DestinationPOISection pointsOfInterest={pointsOfInterest} locale={locale} />'
        );
    });

    it('renders the POI section in the page BODY, not the header slot (unlike attractions)', () => {
        const headerBlockStart = pageSrc.indexOf('<DestinationDetailHeader');
        const headerBlockEnd = pageSrc.indexOf('</Fragment>', headerBlockStart);
        const poiIndex = pageSrc.indexOf('<DestinationPOISection');
        expect(poiIndex).toBeGreaterThan(headerBlockEnd);
    });

    it('defaults pointsOfInterest to an empty array when the API omits the relation (never crashes on undefined)', () => {
        expect(pageSrc).toMatch(
            /pointsOfInterest = \(dest\.pointsOfInterest as[\s\S]*?\}>\)\s*\?\?\s*\[\];/
        );
    });
});
