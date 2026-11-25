/**
 * @file listing-action-bar-secondary-look.test.ts
 * @description HOS-2607: Llamar, Favorito, Compartir and Comparar look the same
 * in the listing action bar, and an active favorite changes ONLY its heart: its
 * border and surface stay those of every other secondary button.
 *
 * jsdom applies no stylesheets, so this reads the rules from the sources and
 * compares selector specificity against every state rule the islands ship.
 * The rendered result is in the HOS-2607 mockup and screenshots.
 *
 * What it does not see: an inline `style` or an `!important` on the island,
 * and any rule outside the bar and island stylesheets.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../../src');
const read = (rel: string): string =>
    readFileSync(resolve(SRC, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const BAR_CSS = read('components/listing/contact/ListingActionBarButtons.module.css');
const FAVORITE_CSS = read('components/shared/favorite/FavoriteButton.module.css');
const COMPARE_CSS = read('components/accommodation/DetailCompareButton.module.css');

type Specificity = readonly [number, number, number];

/** Specificity of one selector. `:global()`/`:not()` contribute their argument. */
function specificity(selector: string): Specificity {
    let s = selector.replace(/:global\(([^()]*)\)/g, ' $1 ');
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

interface Rule {
    readonly selectors: readonly string[];
    readonly decls: Readonly<Record<string, string>>;
}

/** Flat rules of a stylesheet (nested `@media` bodies included as their own rules). */
function rulesOf(css: string): Rule[] {
    const out: Rule[] = [];
    for (const match of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
        const [, head = '', body = ''] = match;
        const decls: Record<string, string> = {};
        for (const decl of body.split(';')) {
            const at = decl.indexOf(':');
            if (at < 0) continue;
            decls[decl.slice(0, at).trim()] = decl.slice(at + 1).trim();
        }
        out.push({
            selectors: head
                .split(',')
                .map((sel) => sel.trim())
                .filter(Boolean),
            decls
        });
    }
    return out;
}

/**
 * The single bar rule whose selector list is exactly `[selector]`, or, when the
 * selector is listed with others, the single rule that names it.
 */
function barRule(selector: string): Rule {
    const all = rulesOf(BAR_CSS).filter((rule) => rule.selectors.includes(selector));
    const own = all.filter((rule) => rule.selectors.length === 1);
    const found = own.length > 0 ? own : all;
    if (found.length !== 1) throw new Error(`expected one bar rule for ${selector}`);
    return found[0] as Rule;
}

const PAINT = ['border-color', 'background-color', 'color'] as const;

describe('listing action bar: one secondary look (HOS-2607)', () => {
    const action = barRule('.action');

    it.each([
        ['favorite', '.row .island .favorite[aria-pressed]'],
        ['compare', '.row .island .compare[aria-pressed]']
    ])('the %s island takes the .action surface, border and ink in every state', (_cls, sel) => {
        const rule = barRule(sel);

        expect(rule.decls['background-color']).toBe(action.decls['background-color']);
        expect(rule.decls.color).toBe(action.decls.color);
        // `.action` spells its border as a shorthand; the colour part must match.
        expect(action.decls.border).toContain(rule.decls['border-color'] ?? '<none>');
    });

    it('the share trigger takes the same surface, border and ink', () => {
        const share = barRule('.share :global(button[aria-expanded])');

        expect(share.decls['background-color']).toBe(action.decls['background-color']);
        expect(share.decls.color).toBe(action.decls.color);
        expect(share.decls.border).toBe(action.decls.border);
    });

    it('an active favorite changes ONLY the heart colour', () => {
        const active = barRule('.row .island .favorite[aria-pressed="true"]');

        expect(Object.keys(active.decls)).toEqual(['color']);
        expect(active.decls.color).toBe('var(--destructive)');
    });

    it('a selected compare changes ONLY the glyph colour', () => {
        const active = barRule('.row .island .compare[aria-pressed="true"]');

        expect(Object.keys(active.decls)).toEqual(['color']);
    });

    it.each([
        ['favorite', FAVORITE_CSS, '.row .island .favorite[aria-pressed]'],
        ['compare', COMPARE_CSS, '.row .island .compare[aria-pressed]']
    ])('the bar rule for .%s outranks every state rule of the island that paints', (_cls, islandCss, sel) => {
        const bar = specificity(sel);
        const painting = rulesOf(islandCss)
            .filter((rule) => PAINT.some((prop) => prop in rule.decls))
            .flatMap((rule) => rule.selectors)
            .filter((s) => /\.button\b/.test(s));

        expect(painting.length).toBeGreaterThan(0);
        for (const islandSel of painting) {
            expect(greater(bar, specificity(islandSel)), `${sel} vs ${islandSel}`).toBe(true);
        }
    });

    it('every secondary glyph is drawn in the same 22px box', () => {
        const box = barRule('.row .island .favorite svg');

        expect(box.selectors).toEqual([
            '.row .island .favorite svg',
            '.row .island .compare svg',
            '.share :global(button[aria-expanded] svg)'
        ]);
        expect(box.decls).toEqual({ width: '22px', height: '22px' });
    });

    it('the secondary surface is the dock token, a light tint in light mode', () => {
        expect(action.decls['background-color']).toBe('var(--dock-action-surface)');
    });
});

describe('listing action bar: the primary (HOS-2607 round 3)', () => {
    const primary = barRule('.primary');

    it('is round: the same 44px as every secondary, not a 52px pill', () => {
        expect(primary.decls['inline-size']).toBe('44px');
        expect(barRule('.action').decls['inline-size']).toBe('44px');
    });

    it('is filled orange with a white glyph, the orange dark enough for 3:1', () => {
        expect(primary.decls.background).toBe('var(--brand-accent-l82)');
        expect(primary.decls.color).toBe('var(--on-action-accent)');
    });
});
