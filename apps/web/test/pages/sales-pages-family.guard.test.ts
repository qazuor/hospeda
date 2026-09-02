/**
 * @file sales-pages-family.guard.test.ts
 * @description HOS-985 AC-59 / AC-62 / AC-63 — the five level-2 sales pages
 * under `/planes/<audiencia>/` stay one family.
 *
 * ## Why a guard and not five reviews
 *
 * The whole point of HOS-985 is that the five destinations of the audience
 * index stopped being five different pages. Nothing in the type system says so:
 * each is an independent `.astro` file, and pasting a hand-rolled `<section>`
 * into one of them compiles, renders, looks approximately right, and quietly
 * ends the standardisation. That is not a hypothetical failure — HOS-331
 * happened because two surfaces rendering the same promise drifted apart, and
 * before this issue there were three different section layouts across the five
 * audiences.
 *
 * So the family is asserted as a family, over whatever files exist at the time
 * the suite runs rather than over a list written today.
 *
 * ## Discovery, with a count to keep it honest
 *
 * The audiences are read from the directory, because a guard enumerating them
 * by hand would silently stop covering a sixth page the day one is added. But
 * discovery alone can also silently cover NOTHING — a renamed directory yields
 * an empty list and every `for` below passes vacuously. The expected slugs and
 * their count are therefore asserted first: discovery finds the files, the
 * frozen set proves discovery worked.
 *
 * Adding a sixth audience means adding its slug here, in the sitemap, and in
 * the a11y sweep — which is exactly the checklist this file exists to enforce.
 *
 * ## What each rule is protecting
 *
 * - **Shared components (AC-59)** — the three extracted sections must be
 *   IMPORTED, and hand-rolled equivalents must not appear. `<details>` is
 *   banned outright because it is the FAQ accordion's own element and its only
 *   legitimate home is `FaqSection`; a `<section>` whose class names benefits,
 *   steps or faq is banned for the same reason. The page's own closing CTA
 *   (`<section class="sales-cta …">`) is deliberately NOT banned: it was never
 *   extracted, every one of the five carries it, and it is three lines.
 * - **Registration (AC-62)** — a new page that is missing from the a11y sweep
 *   inventory or from the baseline fails the A11y job with an error that says
 *   nothing about the page that caused it. Both files are checked here, where
 *   the message can name the file and the key.
 * - **Cache class (AC-63)** — the middleware is fail-closed (HOS-941 R-5), so a
 *   page without `applyCacheHeaders` does not break loudly; it just stops being
 *   edge-cacheable. The molde these pages came from,
 *   `suscriptores/propietarios/index.astro`, claimed "SSR + Cloudflare cache"
 *   in its docblock and called `applyCacheHeaders` on no line at all.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FAMILY_DIR = resolve(__dirname, '../../src/pages/[lang]/planes');

/**
 * Every audience the family serves today (HOS-941 D-8).
 *
 * `gastronomia`, not `restaurantes`: D-9 — HOS-986 is open because
 * "restaurante" reads as excluding food trucks, rotiserías and parrillas, and
 * a URL is the most expensive place to carry that word.
 */
const EXPECTED_AUDIENCES = [
    'aliados',
    'anfitriones',
    'experiencias',
    'gastronomia',
    'turistas'
] as const;

/** The three sections that were extracted into shared components (AC-59). */
const REQUIRED_COMPONENTS = [
    'BenefitsSection',
    'StepsSection',
    'FaqSection',
    'MarketingHero'
] as const;

/**
 * Hand-rolled section markup, as anchored patterns.
 *
 * Anchored on `<section`/`<details` rather than on the bare class words, so a
 * page may still mention "benefits" in a comment or an i18n key — which all
 * five do — without tripping a guard whose message would then be a lie about
 * what the file contains.
 */
const BANNED_MARKUP = [
    {
        label: 'a hand-rolled <details> accordion (FaqSection owns that element)',
        pattern: /<details\b/
    },
    {
        label: 'a hand-rolled <section> for benefits, steps or the FAQ',
        pattern: /<section[^>]*class="[^"]*(benefits|steps|faq|how-it-works)/
    }
] as const;

const audiences = readdirSync(FAMILY_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

const readPage = (audience: string): string =>
    readFileSync(resolve(FAMILY_DIR, audience, 'index.astro'), 'utf8');

const sitemap = readFileSync(
    resolve(__dirname, '../../src/lib/seo/static-sitemap-pages.ts'),
    'utf8'
);
const sweep = readFileSync(resolve(__dirname, '../../scripts/a11y-sweep/sweep.ts'), 'utf8');
const baseline = JSON.parse(
    readFileSync(resolve(__dirname, '../../scripts/a11y-sweep/a11y-baseline.json'), 'utf8')
) as Record<string, ReadonlyArray<string>>;

describe('HOS-985 — the five sales pages are one family', () => {
    it('discovers exactly the audiences it expects', () => {
        // Without this the loops below pass on an empty directory listing.
        expect(audiences).toEqual([...EXPECTED_AUDIENCES]);
    });

    for (const audience of EXPECTED_AUDIENCES) {
        describe(`/planes/${audience}/`, () => {
            const src = readPage(audience);

            it.each(REQUIRED_COMPONENTS)('renders its sections with %s', (component) => {
                expect(src).toContain(`components/marketing/${component}.astro`);
            });

            it.each(BANNED_MARKUP)('does not reintroduce $label', ({ pattern }) => {
                expect(pattern.test(src)).toBe(false);
            });

            it('declares a cache class and a tag', () => {
                expect(src).toContain('applyCacheHeaders');
                expect(src).toContain("cacheClass: 'pricing'");
                expect(src).toContain('CACHE_TAG_PRICING');
            });

            it('is listed in the static sitemap', () => {
                expect(sitemap).toContain(`{ path: '/planes/${audience}/'`);
            });

            it('is swept for accessibility, with both baseline keys', () => {
                const inventoryLine = sweep
                    .split('\n')
                    .find((line) => line.includes(`/es/planes/${audience}/'`));

                expect(inventoryLine, `no a11y sweep inventory entry`).toBeDefined();

                const name = /name: '([^']+)'/.exec(inventoryLine ?? '')?.[1];
                expect(name, `inventory entry has no name`).toBeDefined();

                // An inventory entry with no baseline key fails the A11y job
                // with an error that never names the page that caused it.
                expect(Object.keys(baseline)).toContain(`${name} [light]`);
                expect(Object.keys(baseline)).toContain(`${name} [dark]`);
            });
        });
    }

    it('would actually catch hand-rolled markup — the predicate is live', () => {
        // Without this, every assertion above passes just as happily on a
        // pattern that matches nothing.
        const planted =
            '<section class="pub-rest__benefits section"><details>…</details></section>';
        const caught = BANNED_MARKUP.filter(({ pattern }) => pattern.test(planted));

        expect(caught).toHaveLength(BANNED_MARKUP.length);
    });

    it('does not ban the closing CTA the five pages share', () => {
        // The counterpart to the test above: a predicate broad enough to catch
        // the old layouts must still be narrow enough to leave this alone, or
        // the next author deletes the guard instead of the markup.
        const ctaBlock = '<section class="sales-cta section section--warm">';
        const caught = BANNED_MARKUP.filter(({ pattern }) => pattern.test(ctaBlock));

        expect(caught).toEqual([]);
    });
});
