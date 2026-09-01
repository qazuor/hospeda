/**
 * @file suscriptores/planes-index.test.ts
 * @description Page-level guards for the HOS-942 plan surface: the new audience
 * index, the two pricing pages it now sits above, and the 301 left behind at the
 * tourist page's old URL.
 *
 * ## What is asserted here vs. in the unit test
 *
 * Vitest cannot render `.astro`, so a source-reading test can only ever say
 * "this file DECLARES X" — never "the page RENDERS X". Everything that is a
 * claim about output (five cards, prices resolving, degrading to no price) is
 * asserted in `test/lib/billing/audience-plans.test.ts`, against executable
 * code. What stays here is the class of property that genuinely lives in the
 * page file and nowhere else: which module the page maps over, whether it
 * hydrates anything, which cache class it declares, and — for the redirect —
 * its status code.
 *
 * The sitemap section is the exception and is real behaviour: it imports the
 * live constants, so it fails if the classification and the routes disagree.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NON_SITEMAP_STATIC_PAGES, STATIC_SITEMAP_PAGES } from '@/lib/seo/static-sitemap-pages';

const PAGES = resolve(__dirname, '../../../src/pages/[lang]');

const read = (relative: string): string => readFileSync(resolve(PAGES, relative), 'utf8');

const indexSrc = read('suscriptores/planes/index.astro');
const hostSrc = read('suscriptores/planes/anfitriones/index.astro');
const touristSrc = read('suscriptores/planes/turistas/index.astro');
const redirectSrc = read('suscriptores/turistas/index.astro');

// ---------------------------------------------------------------------------
// AC-1 — five cards, none of them behind an interaction
// ---------------------------------------------------------------------------

describe('plan index — the five audience cards (AC-1)', () => {
    it('derives its cards from the shared audience order, not a local literal', () => {
        expect(indexSrc).toContain("} from '@/lib/billing/audience-plans'");
        expect(indexSrc).toContain('AUDIENCE_CARD_ORDER.map(');
        expect(indexSrc).toContain('AUDIENCE_CARD_PATHS[id]');
    });

    it('hydrates nothing — every card is in the SSR HTML', () => {
        // A `client:*` directive is the only way a card could depend on JS
        // running. Its absence is what makes "no tabs, no accordion, no
        // carousel" checkable rather than a claim in a comment.
        expect(indexSrc).not.toMatch(/\bclient:(load|idle|visible|media|only)\b/);
    });

    it('uses no disclosure widget that could hide a card', () => {
        expect(indexSrc).not.toContain('<details');
        expect(indexSrc).not.toContain('aria-expanded');
        expect(indexSrc).not.toContain('role="tab"');
        expect(indexSrc).not.toContain('role="tablist"');
        // The HTML `hidden` attribute, and ONLY that. The lookbehind is what
        // stops this from also matching `aria-hidden`, which it used to catch by
        // accident: this rule is about a card being hidden behind a control, and
        // `aria-hidden` on a decorative tick is not that. The card-level
        // `aria-hidden` this no longer sees is caught by the next test instead,
        // which is a stricter statement than the one it replaces.
        expect(indexSrc).not.toMatch(/(?<![-\w])hidden\b\s*(=|\/?>)/);
    });

    it('hides nothing from assistive tech except the decorative glyphs', () => {
        // `aria-hidden` is legitimate on an icon whose meaning is carried by the
        // text beside it, and illegitimate on anything else — a card, a list, a
        // price. Enumerating the elements that carry it is what keeps the first
        // statement true without forbidding the second.
        const carriers = [...indexSrc.matchAll(/<(\w+) class="([^"]+)" aria-hidden="true"/g)].map(
            (match) => match[2]
        );

        expect(carriers).toEqual(['audiences__card-check']);
    });

    it('renders one list item per card, each wrapping a real link', () => {
        expect(indexSrc).toContain('<li class="audiences__item"');
        expect(indexSrc).toContain('<a class="audiences__card" href={card.href}>');
    });
});

// ---------------------------------------------------------------------------
// AC-1b / AC-2b — a card has to sell its vertical, not just link to it
// ---------------------------------------------------------------------------

describe('plan index — each card says what THAT audience gets (AC-1b)', () => {
    it('renders the highlights from the shared resolver, never inline copy', () => {
        // What the bullets SAY, that there are three of them and that no line is
        // shared between two audiences are executable claims and live in
        // `test/lib/billing/audience-card-content.test.ts`. What lives here is
        // the only part that is genuinely a property of the page: that it goes
        // through the resolver at all.
        expect(indexSrc).toContain("} from '@/lib/billing/audience-card-content'");
        expect(indexSrc).toContain('resolveAudienceHighlights({ id, t })');
        expect(indexSrc).toContain('class="audiences__card-highlight"');
    });

    it('drops the whole list rather than rendering an empty one', () => {
        expect(indexSrc).toContain('{card.highlights.length > 0 && (');
    });

    it('writes no user-facing copy into the page itself', () => {
        // Every string a visitor reads goes through `t()`; a literal here would
        // serve Spanish under /en and /pt.
        expect(indexSrc).toContain("t('pricing.index.highlightsLabel'");
    });
});

describe('plan index — the five audiences are told apart without reading (AC-2b)', () => {
    it('gives every card a glyph resolved per audience', () => {
        expect(indexSrc).toContain('AUDIENCE_CARD_ICONS[id]');
        expect(indexSrc).toContain('<AudienceIcon size="md" weight="bold" />');
    });

    it('takes the glyph colour from the card, which duotone would ignore', () => {
        // `createPhosphorIcon` only forwards `color` (default `currentColor`) on
        // the non-duotone weights; under `duotone` it paints the icon package's
        // own brand blue and all five glyphs come out identical.
        expect(indexSrc).not.toMatch(/<AudienceIcon[^>]*weight="duotone"/);
    });

    it('declares a distinct accent for each of the five audiences', () => {
        const declared = [
            ...indexSrc.matchAll(/data-audience='([a-z]+)'\]\s*\{\s*--audience-ink:\s*([^;]+);/g)
        ];

        expect(declared.map((match) => match[1]).sort()).toEqual([
            'experience',
            'gastronomy',
            'host',
            'partner',
            'tourist'
        ]);
        // Two audiences sharing an ink distinguish nothing.
        expect(new Set(declared.map((match) => match[2]?.trim())).size).toBe(5);
    });

    it('keeps the accent off every piece of card TEXT', () => {
        // Two of the five inks are decorative tints that do not clear AA as body
        // text. The accent paints a glyph, a rule, a bullet and a hover border —
        // nothing a reader has to read.
        expect(indexSrc).not.toMatch(/\bcolor:\s*var\(--audience-ink\)\s*;[\s\S]{0,40}font-size/);
        for (const rule of [
            '.audiences__card-title',
            '.audiences__card-audience',
            '.audiences__card-highlight',
            '.audiences__card-cta'
        ]) {
            const body = indexSrc.match(new RegExp(`\\${rule} \\{([^}]*)\\}`))?.[1] ?? '';
            expect(body, rule).not.toContain('color: var(--audience-ink)');
        }
    });

    it('falls back to a real ink rather than an undefined custom property', () => {
        // `var(--audience-ink)` with nothing behind it resolves to the initial
        // value and erases the glyph in silence — the same class of failure as
        // `var(--core-border)`.
        const item = indexSrc.match(/\.audiences__item \{([^}]*)\}/)?.[1] ?? '';

        expect(item).toContain('--audience-ink:');
    });

    it('uses --border, never --core-border', () => {
        expect(indexSrc).not.toContain('--core-border');
    });
});

describe('plan index — the highlight list is a list, and it lines up', () => {
    it('resets the browser’s own list indent, which is what pushed it out of the card', () => {
        // Every `ul` gets ~40px of `padding-inline-start` from the UA sheet. Left
        // in place, the bullets start to the LEFT of the title and the paragraph
        // above them — which is exactly how it shipped and what the owner saw.
        const list = indexSrc.match(/\.audiences__card-highlights \{([^}]*)\}/)?.[1] ?? '';

        expect(list).toContain('list-style: none;');
        expect(list).toMatch(/padding: 0;/);
    });

    it('gives each item a tick from @repo/icons, not an inline svg or a CSS dot', () => {
        expect(indexSrc).toContain('CheckIcon');
        expect(indexSrc).toContain('<CheckIcon size="sm" weight="bold" />');
        expect(indexSrc).not.toContain('<svg');
        // The CSS pseudo-dot this replaced.
        expect(indexSrc).not.toContain('.audiences__card-highlight::before');
    });

    it('lays the item out in two columns, so a two-line bullet does not slide under the tick', () => {
        // A marker hung in the text's own `padding-inline-start` wraps
        // underneath itself on the second line. A flex row with a `flex: none`
        // tick cannot.
        const item = indexSrc.match(/\.audiences__card-highlight \{([^}]*)\}/)?.[1] ?? '';
        const check = indexSrc.match(/\.audiences__card-check \{([^}]*)\}/)?.[1] ?? '';

        expect(item).toContain('display: flex;');
        expect(item).toContain('align-items: flex-start;');
        expect(item).toContain('gap:');
        // No hanging indent left behind — that would double the offset.
        expect(item).not.toContain('padding-inline-start:');
        expect(check).toContain('flex: none;');
    });

    it('keeps the item text at the card’s own left edge', () => {
        // Nothing between the list box and the sentence may add an inset: the
        // list resets the UA padding, the item adds none, and the tick is a
        // sibling column rather than something the text is pushed past.
        const list = indexSrc.match(/\.audiences__card-highlights \{([^}]*)\}/)?.[1] ?? '';

        expect(list).not.toMatch(/padding-inline-start: (?!0)/);
        expect(list).not.toMatch(/margin-inline-start: (?!0)/);
    });
});

// ---------------------------------------------------------------------------
// AC-2 — one column at 375px, never a horizontal scrollbar
// ---------------------------------------------------------------------------

describe('plan index — mobile layout (AC-2)', () => {
    it('declares a single-column grid before any width media query', () => {
        const singleColumn = indexSrc.indexOf('grid-template-columns: 1fr;');
        const firstMediaQuery = indexSrc.indexOf('@media (min-width:');

        expect(singleColumn).toBeGreaterThan(-1);
        expect(firstMediaQuery).toBeGreaterThan(-1);
        expect(singleColumn).toBeLessThan(firstMediaQuery);
    });

    it('only ever adds columns at a MIN width, never a max', () => {
        // A `max-width` query would mean the multi-column layout is the base
        // and 375px is the exception — the inverse of a mobile-first grid.
        expect(indexSrc).not.toContain('@media (max-width:');
    });

    it('lets grid tracks shrink below their content (no overflow)', () => {
        expect(indexSrc).toContain('minmax(0, 1fr)');
        expect(indexSrc).toContain('min-width: 0;');
        expect(indexSrc).toContain('overflow-wrap: anywhere;');
    });
});

// ---------------------------------------------------------------------------
// AC-5 / AC-8 — no redirect, no hardcoded price
// ---------------------------------------------------------------------------

describe('plan index — content changed, location did not (AC-5)', () => {
    it('serves a page rather than redirecting', () => {
        expect(indexSrc).not.toContain('Astro.redirect');
        expect(indexSrc).not.toContain('status: 301');
    });
});

describe('plan index — prices come from the API (AC-8)', () => {
    it('fetches the starting prices instead of importing a constant', () => {
        expect(indexSrc).toContain('await fetchAudienceStartingPrices()');
        expect(indexSrc).not.toContain('@repo/billing');
        expect(indexSrc).not.toContain('pricing-fallbacks');
    });

    it('writes no currency amount into the page', () => {
        // Any `$1.234` / `$ 1234` literal would be a price the operator cannot
        // change from admin.
        expect(indexSrc).not.toMatch(/\$\s?\d/);
    });

    it('drops only the price line when a price is missing, never the CTA', () => {
        // The price block is guarded by `card.priceLabel`; the CTA is not.
        //
        // Asserted by NESTING DEPTH rather than by string order: the price
        // paragraph lives one level inside the conditional, so it is indented
        // deeper than the CTA, which is a direct child of the card. A `)}`
        // position check would have been satisfied by the block's own INNER
        // conditional (`card.showPeriod`) and would have stayed green with the
        // CTA moved under the guard — the exact mutation this exists to catch.
        expect(indexSrc).toContain('{card.priceLabel && (');

        const lines = indexSrc.split('\n');
        const indentOf = (marker: string): number => {
            const line = lines.find((candidate) => candidate.includes(marker));
            expect(line, `no line contains ${marker}`).toBeDefined();
            return (line as string).match(/^\t*/)?.[0].length ?? 0;
        };

        expect(indentOf('<span class="audiences__card-cta">')).toBeLessThan(
            indentOf('<p class="audiences__card-price">')
        );
    });
});

// ---------------------------------------------------------------------------
// AC-7 — all three pages are publicly cacheable and tagged
// ---------------------------------------------------------------------------

describe('the three plan pages declare a purgeable public cache (AC-7)', () => {
    const pages: ReadonlyArray<{ readonly name: string; readonly source: string }> = [
        { name: 'planes/index.astro', source: indexSrc },
        { name: 'planes/anfitriones/index.astro', source: hostSrc },
        { name: 'planes/turistas/index.astro', source: touristSrc }
    ];

    it.each(pages)('$name routes its headers through applyCacheHeaders', ({ source }) => {
        expect(source).toContain('applyCacheHeaders({');
        expect(source).toContain('cacheable: true');
        expect(source).toContain("cacheClass: 'pricing'");
        expect(source).toContain('tags: [CACHE_TAG_PRICING]');
    });

    it.each(pages)('$name never writes Cache-Control by hand', ({ source }) => {
        // Setting the header directly is what produced cacheable-but-untaggable
        // responses (HOS-426); `applyCacheHeaders` is fail-closed and must stay
        // the only writer.
        expect(source).not.toMatch(/['"]Cache-Control['"]\s*[,:]/i);
    });
});

// ---------------------------------------------------------------------------
// AC-3 — the host page is the old owner pricing page
// ---------------------------------------------------------------------------

describe('host pricing page kept its content at the new URL (AC-3)', () => {
    it('still renders the owner plan grid', () => {
        expect(hostSrc).toContain(
            "import PricingCardsGrid from '@/components/billing/PricingCardsGrid.astro'"
        );
        expect(hostSrc).toContain('plans={ownerPlans}');
        expect(hostSrc).toContain('audience="owner"');
        expect(hostSrc).toContain("filterPlansByCategory(fetchResult.plans, 'owner')");
    });

    it('still emits its price JSON-LD', () => {
        expect(hostSrc).toContain('<PriceSpecificationJsonLd slot="head-extra"');
    });

    it('still renders its hero', () => {
        expect(hostSrc).toContain('<MarketingHero');
        expect(hostSrc).toContain("t('pricing.owner.tagline'");
    });

    it('points its own canonical JSON-LD URL at the new path', () => {
        expect(hostSrc).toContain("path: 'suscriptores/planes/anfitriones'");
    });
});

// ---------------------------------------------------------------------------
// AC-4 — the tourist page's old URL is a 301
// ---------------------------------------------------------------------------

describe('the tourist pricing page moved (AC-4)', () => {
    it('answers 301 at the old URL', () => {
        expect(redirectSrc).toContain(
            "return Astro.redirect(buildUrl({ locale, path: 'suscriptores/planes/turistas' }), 301);"
        );
    });

    it('is a redirect and nothing else — no 200 body left behind', () => {
        expect(redirectSrc).not.toContain('<MarketingLayout');
        expect(redirectSrc).not.toContain('PricingCardsGrid');
        expect(redirectSrc).not.toContain('fetchPublicPlans');
    });

    it('renders on demand, so the redirect is actually executed', () => {
        expect(redirectSrc).toContain('export const prerender = false;');
    });

    it('serves the tourist catalogue at the new URL', () => {
        expect(touristSrc).toContain("filterPlansByCategory(fetchResult.plans, 'tourist')");
        expect(touristSrc).toContain('audience="tourist"');
    });
});

// ---------------------------------------------------------------------------
// AC-6 — every route classified, and the redirect out of the sitemap
// ---------------------------------------------------------------------------

describe('sitemap classification of the moved routes (AC-6)', () => {
    const emitted = new Set(STATIC_SITEMAP_PAGES.map((page) => page.path));

    it('advertises the index and both pricing pages', () => {
        expect(emitted).toContain('/suscriptores/planes/');
        expect(emitted).toContain('/suscriptores/planes/anfitriones/');
        expect(emitted).toContain('/suscriptores/planes/turistas/');
    });

    it('stops advertising the URL that is now a 301', () => {
        expect(emitted).not.toContain('/suscriptores/turistas/');
        expect(NON_SITEMAP_STATIC_PAGES['/suscriptores/turistas/']).toBe('transactional');
    });

    it('keeps the tourist comparison table indexable — only the index moved', () => {
        expect(emitted).toContain('/suscriptores/turistas/comparar/');
    });
});
