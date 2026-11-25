/**
 * @file listing-action-bar-island-size.test.ts
 * @description HOS-2606: the reused islands of the listing action bar
 * (`FavoriteButton`, `DetailCompareButton`) must render at the bar's 44×44
 * target. The bar resizes them from its own stylesheet, so its rule has to win
 * the cascade over every size rule the island ships. Between two CSS modules
 * the load order is not guaranteed, so a tie in specificity is a loss: the
 * favorite rendered 32×32 (its `compact` variant rule tied the bar's
 * `.island .favorite`) and sat 6px lower than its neighbours.
 *
 * jsdom does not apply stylesheets, so this compares selector specificity
 * read from the sources. The rendered boxes are measured by
 * `apps/e2e/tests/guest/guest-13-listing-detail-action-bar.spec.ts` (AC-34).
 *
 * What it does not see: an inline `style` or an `!important` on the island.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../../src');
const read = (rel: string): string => readFileSync(resolve(SRC, rel), 'utf8');

type Specificity = readonly [number, number, number];

/** Specificity of one compound selector list item. Unwraps `:global(...)`. */
function specificity(selector: string): Specificity {
    let s = selector;
    // :global(x) contributes x; :not/:is/:has contribute their argument.
    s = s.replace(/:global\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, ' $1 ');
    s = s.replace(/:(?:not|is|has)\(([^()]*)\)/g, ' $1 ');
    const ids = (s.match(/#[\w-]+/g) ?? []).length;
    const classes =
        (s.match(/\.[\w-]+/g) ?? []).length +
        (s.match(/\[[^\]]+\]/g) ?? []).length +
        (s.match(/:(?!:)[\w-]+/g) ?? []).length;
    const elements = (
        s.replace(/\[[^\]]+\]|\.[\w-]+|#[\w-]+|:{1,2}[\w-]+/g, ' ').match(/[a-z][\w-]*/gi) ?? []
    ).length;
    return [ids, classes, elements];
}

const greater = (a: Specificity, b: Specificity): boolean =>
    a[0] === b[0] ? (a[1] === b[1] ? a[2] > b[2] : a[1] > b[1]) : a[0] > b[0];

/** Every selector of a rule that sets `width` or `height`, comments stripped. */
function sizeSelectors(css: string): string[] {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const out: string[] = [];
    for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const [, head = '', body = ''] = match;
        if (!/(^|;|\s)(width|height)\s*:/.test(body)) continue;
        for (const sel of head.split(',')) {
            const trimmed = sel.trim();
            if (trimmed && !trimmed.startsWith('@')) out.push(trimmed);
        }
    }
    return out;
}

const BAR_CSS = read('components/listing/contact/ListingActionBarButtons.module.css');
const BAR_TSX = read('components/listing/contact/ListingActionBarButtons.tsx');

/** The bar selector that resizes the given island class (`favorite`, `compare`). */
function barSelectorFor(cls: string): string {
    const found = sizeSelectors(BAR_CSS).find((sel) => new RegExp(`\\.${cls}\\b`).test(sel));
    if (!found) throw new Error(`no size rule for .${cls} in the bar stylesheet`);
    return found;
}

describe('listing action bar: reused islands render at 44x44 (HOS-2606, AC-34)', () => {
    it.each([
        ['favorite', 'components/shared/favorite/FavoriteButton.module.css'],
        ['compare', 'components/accommodation/DetailCompareButton.module.css']
    ])('the bar rule for .%s outranks every size rule of the island', (cls, islandCss) => {
        const bar = specificity(barSelectorFor(cls));
        const islandRules = sizeSelectors(read(islandCss)).filter((sel) => /\.button\b/.test(sel));
        expect(islandRules.length).toBeGreaterThan(0);
        for (const sel of islandRules) {
            expect(greater(bar, specificity(sel)), `${barSelectorFor(cls)} vs ${sel}`).toBe(true);
        }
    });

    it('sizes both islands to 44px', () => {
        const clean = BAR_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
        const rule = clean.match(/[^{}]*\.favorite[^{}]*\{([^}]*)\}/)?.[1] ?? '';
        expect(rule).toMatch(/width:\s*44px/);
        expect(rule).toMatch(/height:\s*44px/);
    });

    it('does not use the compact favorite variant (18px icon) next to 22px icons', () => {
        expect(BAR_TSX).not.toMatch(/variant="compact"/);
    });

    it('the specificity helper counts what the test relies on', () => {
        expect(specificity('.button[data-variant="compact"]')).toEqual([0, 2, 0]);
        expect(specificity(':global(.wave-header--compact) .button')).toEqual([0, 2, 0]);
        expect(specificity('.row .island .favorite')).toEqual([0, 3, 0]);
    });
});
