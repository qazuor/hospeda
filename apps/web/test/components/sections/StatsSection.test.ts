/**
 * @file StatsSection.test.ts
 * @description Source-based assertions for StatsSection.astro's stat-filtering
 * wiring (HOS-117 T-004 / T-018).
 *
 * Astro components cannot be rendered in Vitest here — we assert against
 * source text (see `test/pages/destinos-detail-counts.test.ts` and
 * `test/components/AnimatedCounter.test.tsx` for the same convention).
 *
 * This file only locks the SECTION-LEVEL filtering wiring: that
 * `isMeaningfulStat` is imported and applied to build `visibleStats`, that the
 * section guards on `visibleStats.length > 0` so it never renders when every
 * stat is filtered out, and that each visible stat is rendered through
 * `AnimatedCounter` with `client:visible`. The behavioral guarantee that the
 * counter itself never shows a fake "0" before intersection already lives in
 * `test/components/AnimatedCounter.test.tsx` — not duplicated here.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/sections/StatsSection.astro'),
    'utf8'
);

describe('StatsSection.astro — never emit a fake "0+" (HOS-117 T-004 / T-018)', () => {
    describe('isMeaningfulStat filtering wiring', () => {
        it('imports isMeaningfulStat from @/lib/home-guards', () => {
            expect(src).toContain("import { isMeaningfulStat } from '@/lib/home-guards'");
        });

        it('builds visibleStats by filtering with isMeaningfulStat({ value: stat.value })', () => {
            expect(src).toContain('const visibleStats = stats');
            expect(src).toMatch(
                /\.filter\(\(\{ stat \}\) => isMeaningfulStat\(\{ value: stat\.value \}\)\)/
            );
        });
    });

    describe('section-level render guard', () => {
        it('only renders the section when visibleStats.length > 0', () => {
            expect(src).toContain('{visibleStats.length > 0 && (');
        });
    });

    describe('AnimatedCounter wiring', () => {
        it('imports the AnimatedCounter island', () => {
            expect(src).toContain('AnimatedCounter');
        });

        it('renders <AnimatedCounter with client:visible for each visible stat', () => {
            expect(src).toMatch(/<AnimatedCounter\s+client:visible/);
        });

        it('passes value={stat.value} to AnimatedCounter', () => {
            expect(src).toContain('value={stat.value}');
        });

        it('iterates visibleStats (not the raw stats prop) to render counters', () => {
            expect(src).toContain('{visibleStats.map(({ stat, suffix }, i) => (');
        });
    });
});
