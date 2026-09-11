/**
 * ExperienceMeetingPoint.astro — source-level tests (HOS-1049).
 *
 * ## What this suite can and cannot prove
 *
 * Vitest cannot render `.astro` in this repo (no Astro vite plugin in the test
 * pipeline — `experimental_AstroContainer` fails to transform the file), so
 * these assertions read the SOURCE. That is the documented pattern here — see
 * `test/components/account/PartnerMentionsSection.test.ts` — and it has a real
 * blind spot worth naming twice: a source test cannot tell a branch that is
 * DECLARED from one that is REACHED. It proves the gate expression is spelled
 * the way the tier requires; it does not prove a `false` flag takes the
 * hiding branch.
 *
 * The decision those assertions stand in for IS covered where it can actually
 * execute, and that is the more important half: WHAT REACHES THIS COMPONENT is
 * decided in `apps/api`, by `applyExperienceDirectionsGate`, which is unit
 * tested and mutation-verified in
 * `apps/api/test/routes/experience/public/directions-projection.test.ts`. An
 * unentitled provider's page never receives the instructions at all, so even a
 * component that ignored its own flag could not leak them. What the flag adds
 * on top is the MAP — drawn from coordinates that DO reach every tier — and
 * that is the one thing only this file decides.
 *
 * @module test/components/experience/ExperienceMeetingPoint
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    resolve(__dirname, '../../../src/components/experience/ExperienceMeetingPoint.astro'),
    'utf8'
);

describe('ExperienceMeetingPoint — the free half', () => {
    it('renders the meeting point text with no entitlement condition on it', () => {
        // Owner decision (2026-09-01): the meeting point ships from the basic
        // tier. The section's ONLY condition is that a meeting point exists.
        expect(SOURCE).toContain('{meetingPoint && (');
        // The address paragraph is inside that block and behind nothing else.
        expect(SOURCE).toContain('exp-meeting__address');
    });
});

describe('ExperienceMeetingPoint — the paid half (HOS-1049)', () => {
    it('gates the map on the entitlement AND on having coordinates', () => {
        // Both halves of the conjunction are load-bearing and fail differently:
        // dropping the flag draws the paid map for a basico listing (a
        // give-away), dropping the coordinate check renders a Leaflet map
        // centred on `undefined` (a crash).
        expect(SOURCE).toContain(
            'const showsMap = meetingPointDirectionsEnabled && hasCoordinates;'
        );
    });

    it('gates the instructions on the entitlement AND on there being any', () => {
        expect(SOURCE).toContain(
            'const showsDirections = meetingPointDirectionsEnabled && meetingPointDirections.length > 0;'
        );
    });

    it('tests coordinates with typeof, never truthiness', () => {
        // `lat && long` erases a point on the equator or the prime meridian —
        // 0 is a real coordinate. The same trap `toExperienceDetailPageProps`
        // documents on the way in, and it has to be avoided again here because
        // this file re-derives the check rather than importing it.
        expect(SOURCE).toContain("typeof meetingPointLat === 'number'");
        expect(SOURCE).toContain("typeof meetingPointLong === 'number'");
        expect(SOURCE).not.toContain('meetingPointLat && meetingPointLong');
    });

    it('reuses LocationMap in exact mode rather than adding a fourth mode', () => {
        // A meeting point is one marker at a known coordinate — what
        // `mode="exact"` already draws, and what routes to the
        // `LocationMapInner.client` chunk. The `multi` mode would pull in
        // `react-dom/server` plus the icon table for POI pins; the chunk split
        // exists precisely so single-point maps do not pay for that.
        expect(SOURCE).toContain('mode="exact"');
        expect(SOURCE).not.toContain('mode="multi"');
        expect(SOURCE).toContain("from '@/components/maps/LocationMap.client'");
    });

    it('hydrates the map lazily', () => {
        // The map is below the fold on every ficha. `client:visible` keeps
        // Leaflet out of the initial payload for a page most readers never
        // scroll — and out of it entirely for the unentitled listings, which
        // are the majority while experience-pro is not on sale.
        expect(SOURCE).toContain('client:visible');
    });
});
