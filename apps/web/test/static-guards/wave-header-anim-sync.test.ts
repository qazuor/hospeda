/**
 * @file wave-header-anim-sync.test.ts
 * @description Static guard — the headers that render inside the `WaveHeader`
 * band must drive their layout-collapse transitions off the band's own timing
 * vars, never off a hardcoded duration.
 *
 * WHY A GUARD, AND NOT SEVEN TESTS. The band wrapper collapses at
 * `--wave-header-anim-duration` (`0.45s`, `ease-in-out`, declared once on
 * `.wave-header` in `WaveHeader.astro`) while all seven headers below collapsed
 * their own content at a hardcoded `0.3s ease`. On scroll the content finished
 * shrinking while the band was still moving. The defect is not "this file is
 * wrong" — it is "every file that opts into the band has to agree with it", and
 * the failure mode is a NEW header, or a new section inside an existing one,
 * silently reintroducing a literal. That is a shape a guard answers and a
 * per-component test does not: `EventDetailHeader.astro` alone grew three extra
 * collapse declarations between the original fix being written and it landing.
 *
 * WHAT THE PREDICATE ACTUALLY PROVES, stated narrowly: that in each listed file
 * no COLLAPSE property (`max-height`, `padding`, `padding-top`, `font-size`,
 * `gap`, `margin`, `margin-top`) is immediately followed by a literal duration,
 * and that the file references `--wave-header-anim-duration` at least once. That
 * is "no literal, and opted in" — it is not a claim about rendered motion.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not resolve the cascade: a later
 * rule, a `@media` block, or `global.css` can still override the transition at
 * runtime and this guard stays green. It does not check the var RESOLVES — a
 * header rendered outside the band falls back to the `0.3s` / `ease` defaults
 * baked into each `var()` call, which is the intended standalone behavior, not a
 * violation. And it says nothing about whether the durations LOOK synchronized;
 * only a browser can answer that.
 *
 * COMMENTS ARE NOT STRIPPED, on purpose. This asserts an ABSENCE, and stripping
 * before an absence check is fail-OPEN: an over-greedy strip removes real code
 * and manufactures a pass (this repo has been bitten by exactly that in an
 * `.astro` file). Scanning the raw source can only ever produce a false FAILURE,
 * which a human reads and resolves. The regex requires the property name to be
 * followed directly by a number, so prose mentioning a duration — and the
 * `var(--wave-header-anim-duration, 0.3s)` fallback, where the property is
 * followed by `var(` — cannot match.
 *
 * ALSO NOT SEEN: `opacity` and `color` timings, which stay hardcoded by design
 * (`0.2s` fades and `0.15s` hovers are meant to outrun the collapse), any header
 * added outside the list below, and CSS reaching these components from a module
 * or a global sheet.
 *
 * @module test/static-guards/wave-header-anim-sync
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = path.resolve(__dirname, '../../src');

/**
 * Every header that renders inside the `WaveHeader` slot and collapses its own
 * content on scroll. Adding a header to the band means adding it here.
 */
const BAND_HEADERS = [
    'components/accommodation/DetailHeader.astro',
    'components/destination/DestinationDetailHeader.astro',
    'components/event/EventDetailHeader.astro',
    'components/experience/ExperienceHero.astro',
    'components/gastronomy/GastronomyDetailHeader.astro',
    'components/post/PostDetailHeader.astro',
    'components/shared/layout/ListingPageHeader.astro'
] as const;

/**
 * Layout properties whose collapse must track the band. Ordered longest-first so
 * `padding-top` is not consumed by the `padding` alternative.
 */
const COLLAPSE_PROPS = [
    'max-height',
    'padding-top',
    'padding',
    'font-size',
    'margin-top',
    'margin',
    'gap'
] as const;

/**
 * Matches a collapse property followed directly by a literal duration
 * (`max-height 0.3s`, `gap .45s`, `font-size 300ms`). A property followed by
 * `var(` — including the fallback form — cannot match.
 */
const HARDCODED_DURATION = new RegExp(
    `\\b(${COLLAPSE_PROPS.join('|')})\\s+(\\d*\\.?\\d+m?s)\\b`,
    'g'
);

const TIMING_VAR = '--wave-header-anim-duration';

const read = (relative: string): string => fs.readFileSync(path.join(WEB_SRC, relative), 'utf8');

describe('wave-header band headers: collapse timing', () => {
    it.each(BAND_HEADERS)('%s declares no hardcoded collapse duration', (relative) => {
        const source = read(relative);
        const offenders = [...source.matchAll(HARDCODED_DURATION)].map((m) => m[0]);

        expect(
            offenders,
            `${relative} hardcodes a collapse duration: ${offenders.join(', ')}. ` +
                `Use var(${TIMING_VAR}, 0.3s) var(--wave-header-anim-ease, ease) so the ` +
                'content collapses at the same rate as the band that wraps it.'
        ).toEqual([]);
    });

    it.each(BAND_HEADERS)('%s reads the band timing var', (relative) => {
        expect(
            read(relative).includes(TIMING_VAR),
            `${relative} never references ${TIMING_VAR}, so it has not opted into the ` +
                'band timing at all.'
        ).toBe(true);
    });

    it('WaveHeader.astro still publishes the vars these headers inherit', () => {
        const source = read('components/shared/ui/WaveHeader.astro');

        expect(source).toContain(`${TIMING_VAR}:`);
        expect(source).toContain('--wave-header-anim-ease:');
    });
});
