/**
 * HOS-1063 — static guards over the two partner-facing web surfaces.
 *
 * These assert properties of the SOURCE, and each one is a property a rendering
 * test could not give:
 *
 * - **AC-16**: the home carousel gains no `client:` directive. A rendering test
 *   would happily pass on a page that hydrates a component, because hydration
 *   is invisible to it — what fails here is the addition itself. The constraint
 *   is R-3: the home page's JS budget is the subject of HOS-160 and HOS-168, and
 *   one delegated `click` listener does not justify an island.
 * - **AC-4's markup contract**: the `data-partner-id` attribute appears on the
 *   VISIBLE track and NOT on the `aria-hidden` clone, so a click on a decorative
 *   duplicate matches the listener's selector and records nothing — by
 *   construction rather than by a filter someone must remember.
 * - **AC-8**: the stats section and the mentions section are two separate
 *   components with separate i18n subtrees, which is exactly what
 *   `PartnerMentionsSection.astro:16-21` asked for.
 * - **AC-11 / G-5**: nothing here reaches for the dead `partners.analytics`.
 * - **AC-5**: the click listener never calls `preventDefault`. Delaying a
 *   visitor's navigation to record telemetry is the failure this forbids, and it
 *   is a property of the code, not of a render.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../../src');

const PARTNERS_SECTION = path.join(SRC, 'components/sections/PartnersSection.astro');
const STATS_SECTION = path.join(SRC, 'components/account/PartnerStatsSection.astro');
const MENTIONS_SECTION = path.join(SRC, 'components/account/PartnerMentionsSection.astro');

const read = (file: string): string => readFileSync(file, 'utf-8');

/**
 * Strips comments before matching.
 *
 * Without it every assertion below is defeated by its own documentation — the
 * carousel's script header explains at length why there is no `client:`
 * directive, and a naive search would fire on that sentence. The guard would be
 * red on a correct file and green on a broken one whose author deleted the
 * comment.
 */
const readCode = (file: string): string =>
    read(file)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('HOS-1063 AC-16 — the home carousel gains no island', () => {
    it('contains no client: directive', () => {
        expect(readCode(PARTNERS_SECTION)).not.toMatch(/client:(load|idle|visible|media|only)/);
    });

    /**
     * The positive half. Without it, deleting the whole listener would leave
     * this file green — "contains no client: directive" is trivially true of a
     * file that also contains no listener.
     */
    it('still captures the click, through a delegated listener in a plain script', () => {
        const code = readCode(PARTNERS_SECTION);
        expect(code).toMatch(/sendPartnerLogoClickBeacon/);
        expect(code).toMatch(/addEventListener\(\s*'click'/);
    });
});

describe('HOS-1063 AC-5 — the click never delays the navigation', () => {
    it('never calls preventDefault or returns false from the handler', () => {
        const code = readCode(PARTNERS_SECTION);
        expect(code).not.toMatch(/preventDefault/);
        expect(code).not.toMatch(/return\s+false/);
    });

    it('does not await the beacon', () => {
        const code = readCode(PARTNERS_SECTION);
        expect(code).not.toMatch(/await\s+sendPartnerLogoClickBeacon/);
    });
});

describe('HOS-1063 AC-4 — the decorative duplicate track cannot be counted', () => {
    /**
     * The marquee renders its logos twice: a visible, accessible track and an
     * `aria-hidden` clone that makes the loop seamless. The listener selects on
     * `data-partner-id`, so the assertion is that exactly ONE of the two tracks
     * emits it.
     */
    it('emits data-partner-id exactly once in the template', () => {
        const code = readCode(PARTNERS_SECTION);
        const occurrences = code.match(/data-partner-id=/g) ?? [];
        expect(occurrences).toHaveLength(1);
    });

    it('scopes the listener selector to that attribute rather than to the class alone', () => {
        const code = readCode(PARTNERS_SECTION);
        expect(code).toMatch(/a\.partner-logo-link\[data-partner-id\]/);
    });

    /**
     * The clone is still identified as decorative for assistive technology —
     * asserted so a future refactor that drops `aria-hidden` (and thereby makes
     * the duplicate reachable) is visible here too.
     */
    it('keeps the duplicate track aria-hidden', () => {
        expect(readCode(PARTNERS_SECTION)).toMatch(/aria-hidden="true"/);
    });
});

describe('HOS-1063 AC-8 — stats and mentions are SIBLINGS, never merged', () => {
    it('are two distinct component files', () => {
        expect(read(STATS_SECTION).length).toBeGreaterThan(0);
        expect(read(MENTIONS_SECTION).length).toBeGreaterThan(0);
    });

    it('the stats section renders its own <section> with its own heading', () => {
        const code = readCode(STATS_SECTION);
        expect(code).toMatch(/<section class="partner-stats">/);
        expect(code).toMatch(/<h2/);
    });

    it('the stats section uses ONLY account.partnerStats.* keys', () => {
        const code = readCode(STATS_SECTION);
        const keys = [...code.matchAll(/t\('([^']+)'/g)].map((m) => m[1]);
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) {
            expect(key.startsWith('account.partnerStats.')).toBe(true);
        }
    });

    it('the mentions section never reaches into the stats subtree', () => {
        expect(readCode(MENTIONS_SECTION)).not.toMatch(/account\.partnerStats/);
    });

    it('neither component imports the other', () => {
        expect(readCode(STATS_SECTION)).not.toMatch(/PartnerMentionsSection/);
        expect(readCode(MENTIONS_SECTION)).not.toMatch(/PartnerStatsSection/);
    });
});

describe('HOS-1063 AC-9 — no numeral where the metric does not apply', () => {
    /**
     * The negative branch of the views card must carry no number. Asserted as
     * "the not-applicable branch renders a translation key and no formatter
     * call", rather than by looking for the string "0" — a card rendering `0`
     * through `Intl.NumberFormat` in a locale that spells it differently would
     * pass that test while showing a numeral.
     */
    it('the not-applicable branch formats no number', () => {
        const code = readCode(STATS_SECTION);
        const naStart = code.indexOf('partner-stats__card--na');
        expect(naStart).toBeGreaterThan(-1);

        const naBlock = code.slice(naStart, code.indexOf('</article>', naStart));
        expect(naBlock).toMatch(/account\.partnerStats\.views\.notApplicable/);
        expect(naBlock).not.toMatch(/numberFormatter/);
        expect(naBlock).not.toMatch(/\d/);
    });
});

describe('HOS-1063 AC-11 / §7.2 — no dead column, no tier gating in the view layer', () => {
    /**
     * Matched on the dead column's OWN identifiers, not on the bare word
     * "analytics". A `\banalytics\b` predicate looks stricter and is simply
     * wrong: it fires on the legitimate `@/lib/analytics/view-capture` import
     * that carries the click beacon, so the guard would be red on a correct file
     * — and its message would be claiming something its predicate does not test.
     */
    it.each([
        ['stats section', STATS_SECTION],
        ['partners carousel', PARTNERS_SECTION]
    ])('%s references none of the dead partners.analytics accessors', (_label, file) => {
        const code = readCode(file);
        expect(code).not.toMatch(/partners?\.analytics/);
        expect(code).not.toMatch(/PartnerAnalytics/);
        expect(code).not.toMatch(/incrementAnalytics/);
    });

    it.each([
        ['stats section', STATS_SECTION],
        ['partners carousel', PARTNERS_SECTION]
    ])('%s never compares a tier — that decision belongs to resolvePartnerLogoLink', (_label, file) => {
        const code = readCode(file);
        expect(code).not.toMatch(/tier\s*===/);
        expect(code).not.toMatch(/['"]gold['"]/);
        expect(code).not.toMatch(/['"]silver['"]/);
    });
});
