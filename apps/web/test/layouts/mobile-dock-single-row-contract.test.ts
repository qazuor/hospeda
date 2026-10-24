/**
 * @module test/layouts/mobile-dock-single-row-contract
 * @description HOS-1780 regressions. The mobile dock row used to wrap its
 * round buttons onto a second line (dock height ~64 -> ~123px). The decision
 * is: compact spacing across the whole mobile dock (<=767px), an icon-only
 * Filtros trigger at 360px and below, and a results pill on the map view that
 * degrades full label -> short label -> icon + count (449px / 419px). Widths cannot be computed from CSS, so these
 * parse the cascade and pin the declarations that make the row fit; the real
 * rendered widths were measured in a headless browser (see the HOS-1780 PR).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../src');
const read = (path: string): string => readFileSync(resolve(SRC, path), 'utf8');

const COMPACT = 'max-width: 767px';
const NARROW = 'max-width: 360px';

interface Rule {
    /** Selector with `:global(...)` unwrapped and whitespace collapsed. */
    readonly selector: string;
    /** Every @media prelude enclosing the rule, outermost first. */
    readonly queries: readonly string[];
    readonly decls: Readonly<Record<string, string>>;
    readonly order: number;
}

/** Extracts the first `<style>` block of an .astro file, or returns plain CSS. */
function styleOf(source: string): string {
    return source.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? source;
}

/** Parses CSS into flat rules, remembering the enclosing media queries. */
function parseRules(css: string): Rule[] {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules: Rule[] = [];
    let order = 0;
    const walk = (text: string, queries: readonly string[]): void => {
        let i = 0;
        while (i < text.length) {
            const open = text.indexOf('{', i);
            if (open === -1) return;
            const head = text.slice(i, open).trim();
            let depth = 1;
            let j = open + 1;
            while (j < text.length && depth > 0) {
                if (text[j] === '{') depth++;
                else if (text[j] === '}') depth--;
                j++;
            }
            const body = text.slice(open + 1, j - 1);
            if (head.startsWith('@media')) {
                walk(body, [...queries, head]);
            } else if (!head.startsWith('@')) {
                const decls: Record<string, string> = {};
                for (const part of body.split(';')) {
                    const idx = part.indexOf(':');
                    if (idx > 0) decls[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
                }
                for (const sel of head.split(',')) {
                    const selector = sel
                        .replace(/:global\(((?:[^()]|\([^)]*\))*)\)/g, '$1')
                        .replace(/\s+/g, ' ')
                        .trim();
                    rules.push({ selector, queries, decls, order: order++ });
                }
            }
            i = j;
        }
    };
    walk(clean, []);
    return rules;
}

const inQuery = (rule: Rule, query: string): boolean => rule.queries.some((q) => q.includes(query));

/** Rules for `selector` that apply under `query`, in source order. */
function under(rules: readonly Rule[], selector: string, query: string): Rule[] {
    return rules
        .filter((r) => r.selector === selector && inQuery(r, query))
        .sort((a, b) => a.order - b.order);
}

/** Last declared value of `prop` for `selector` under `query`. */
function valueUnder(
    rules: readonly Rule[],
    selector: string,
    query: string,
    prop: string
): string | undefined {
    return under(rules, selector, query)
        .filter((r) => prop in r.decls)
        .map((r) => r.decls[prop])
        .at(-1);
}

const dock = parseRules(styleOf(read('components/shared/dock/MobileDock.astro')));
const toggle = parseRules(styleOf(read('components/shared/layout/ListingViewToggle.astro')));
const filters = parseRules(read('components/shared/filters/FilterSidebar.module.css'));
const mapCards = parseRules(read('components/maps/MapCardsSidebar.module.css'));

const DOCK_TRIGGER = '[data-mobile-dock] .floatingTrigger';
const DOCK_LABEL = '[data-mobile-dock] .floatingTriggerLabel';

describe('HOS-1780 compact dock across the whole mobile range', () => {
    it('tightens the row gap and lateral padding below the base values', () => {
        const gaps = under(dock, '.mobile-dock__row', COMPACT).filter((r) => 'gap' in r.decls);
        // The base rule keeps `var(--space-2)`; the compact one is declared later.
        expect(gaps.map((r) => r.decls.gap)).toEqual(['var(--space-2)', 'var(--space-1)']);
        // The base padding is the `--space-container-x` clamp (12px on phones).
        expect(valueUnder(dock, '.mobile-dock__row', COMPACT, 'padding-inline')).toBe(
            'var(--space-2)'
        );
    });

    it('declares the compact row rule after the base rules so it wins the cascade', () => {
        const rows = under(dock, '.mobile-dock__row', COMPACT);
        const base = rows.find((r) => r.decls.gap === 'var(--space-2)');
        const compact = rows.find((r) => r.decls.gap === 'var(--space-1)');
        expect(base).toBeDefined();
        expect(compact).toBeDefined();
        expect(base && compact && compact.order > base.order).toBe(true);
        // `padding` (shorthand) must precede `padding-inline` or it would reset it.
        const shorthand = rows.find((r) => 'padding' in r.decls);
        const inline = rows.find((r) => 'padding-inline' in r.decls);
        expect(shorthand && inline && inline.order > shorthand.order).toBe(true);
    });

    it('tightens the gaps inside the start and end groups', () => {
        for (const sel of ['.mobile-dock__start', '.mobile-dock__end']) {
            expect(valueUnder(dock, sel, COMPACT, 'gap')).toBe('var(--space-1)');
        }
        const pill = valueUnder(dock, '.mobile-dock__start:has([data-dock-item])', COMPACT, 'gap');
        expect(pill).toBe('2px');
    });

    it('keeps flex-wrap only as a safety net and never widens the spacing again', () => {
        // Wrapping is the failure mode HOS-1780 removed; the compact rule must
        // stay the LAST word on the row's gap.
        const gaps = under(dock, '.mobile-dock__row', COMPACT).filter((r) => 'gap' in r.decls);
        expect(gaps.at(-1)?.decls.gap).toBe('var(--space-1)');
    });

    it('compacts the Lista/Mapa pill but keeps a 44px hit area', () => {
        const pill = '.view-toggle--dock';
        const btn = '.view-toggle--dock .view-toggle__btn';
        expect(valueUnder(toggle, pill, COMPACT, 'gap')).toBe('2px');
        expect(valueUnder(toggle, btn, COMPACT, 'padding')).toBe('0.5rem 0.625rem');
        // 4px pill padding + 36px buttons = 44px.
        expect(valueUnder(toggle, pill, COMPACT, 'padding')).toBe('4px 2px');
        expect(valueUnder(toggle, btn, '(max-width: 767px)', 'min-height')).toBe('36px');
    });

    it('compacts the Filtros trigger and guarantees its 44px height', () => {
        expect(valueUnder(filters, DOCK_TRIGGER, '(max-width: 767px)', 'min-height')).toBe('44px');
        const compact = valueUnder(filters, DOCK_TRIGGER, COMPACT, 'padding');
        expect(compact).toBe('0.75rem 0.75rem');
        // Declared after the dock rule it overrides (same specificity).
        const paddings = under(filters, DOCK_TRIGGER, COMPACT).filter((r) => 'padding' in r.decls);
        expect(paddings).toHaveLength(2);
        expect(paddings[1].order > paddings[0].order).toBe(true);
    });

    it('keeps the map-cards CTA a 44px target inside the dock', () => {
        expect(
            valueUnder(
                mapCards,
                '[data-mobile-dock] .sheetTrigger',
                '(max-width: 767px)',
                'min-height'
            )
        ).toBe('44px');
    });
});

describe('HOS-1780 icon-only Filtros trigger at 360px and below', () => {
    it('hides the label visually but keeps it in the accessibility tree', () => {
        const label: Record<string, string> = Object.assign(
            {},
            ...under(filters, DOCK_LABEL, NARROW).map((r) => r.decls)
        );
        expect(label.position).toBe('absolute');
        expect(label.width).toBe('1px');
        expect(label.height).toBe('1px');
        expect(label.overflow).toBe('hidden');
        expect(label.clip).toBe('rect(0, 0, 0, 0)');
        // `display: none` / `visibility: hidden` would drop the name from the a11y tree.
        expect(label.display).toBeUndefined();
        expect(label.visibility).toBeUndefined();
    });

    it('is a 44px-wide target when icon-only', () => {
        expect(valueUnder(filters, DOCK_TRIGGER, NARROW, 'min-width')).toBe('44px');
        expect(valueUnder(filters, DOCK_TRIGGER, NARROW, 'justify-content')).toBe('center');
    });

    it('does not hide the label above 360px', () => {
        const everywhere = filters.filter((r) => r.selector === DOCK_LABEL && !inQuery(r, NARROW));
        expect(everywhere).toEqual([]);
    });

    it('scopes the narrow rules to the dock so they outrank the base dock rule', () => {
        // Regression: the previous 360px rule used a bare `.floatingTrigger`
        // selector, which the dock-scoped base rule always outranked, so it
        // never applied inside the dock.
        const bare = filters.filter((r) => r.selector === '.floatingTrigger' && inQuery(r, NARROW));
        expect(bare).toEqual([]);
    });

    it('wires the label span and keeps the aria-label on the button', () => {
        const tsx = read('components/shared/filters/components/FilterDockTrigger.tsx');
        expect(tsx).toMatch(/<span className=\{styles\.floatingTriggerLabel\}>\{label\}<\/span>/);
        expect(tsx).toMatch(/aria-label=\{label\}/);
    });
});

const PILL = '.sheetTrigger';
const SHORT_Q = 'max-width: 449px';
const COUNT_Q = 'max-width: 419px';

describe('HOS-1780 map results pill degrades full -> short -> icon + count', () => {
    const display = (selector: string, query: string): string | undefined =>
        valueUnder(mapCards, selector, query, 'display');

    it('shows only the full label by default', () => {
        const base = (sel: string) =>
            mapCards.filter((r) => r.selector === sel && r.queries.length === 0);
        expect(base('.sheetTriggerFull')).toEqual([]);
        expect(base('.sheetTriggerShort').at(-1)?.decls.display).toBe('none');
        expect(base('.sheetTriggerCount').find((r) => 'display' in r.decls)?.decls.display).toBe(
            'none'
        );
    });

    it('swaps the full label for the short one at 449px and below', () => {
        expect(display('.sheetTriggerFull', SHORT_Q)).toBe('none');
        expect(display('.sheetTriggerShort', SHORT_Q)).toBe('inline');
    });

    it('swaps the short label for icon + count at 419px and below', () => {
        expect(display('.sheetTriggerShort', COUNT_Q)).toBe('none');
        expect(display('.sheetTriggerCount', COUNT_Q)).toBe('inline-flex');
    });

    it('keeps the icon + count variant a 44px-wide target inside the dock', () => {
        expect(valueUnder(mapCards, `[data-mobile-dock] ${PILL}`, COUNT_Q, 'min-width')).toBe(
            '44px'
        );
        expect(valueUnder(mapCards, `[data-mobile-dock] ${PILL}`, COUNT_Q, 'justify-content')).toBe(
            'center'
        );
    });

    it('declares the swaps after the base display:none so they win the cascade', () => {
        const base = mapCards.filter(
            (r) => r.selector === '.sheetTriggerShort' && r.queries.length === 0
        );
        const swap = under(mapCards, '.sheetTriggerShort', SHORT_Q);
        expect(base.length).toBeGreaterThan(0);
        for (const rule of base) expect(swap[0].order > rule.order).toBe(true);
    });

    it('wires the three variants and keeps the full label as the accessible name', () => {
        const tsx = read('components/maps/MapCardsSheetTrigger.tsx');
        expect(tsx).toMatch(/aria-label=\{label\}/);
        for (const cls of ['sheetTriggerFull', 'sheetTriggerShort', 'sheetTriggerCount']) {
            expect(tsx).toContain(`sidebarStyles.${cls}`);
        }
        // Each visible part is aria-hidden so the name is not announced twice,
        // and none is removed from the DOM or hidden with a rule that drops the
        // button's own name.
        expect(tsx.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(3);
    });

    it('feeds the short label through i18n in es, en and pt', () => {
        for (const locale of ['es', 'en', 'pt']) {
            const maps = JSON.parse(
                readFileSync(
                    resolve(__dirname, `../../../../packages/i18n/src/locales/${locale}/maps.json`),
                    'utf8'
                )
            ) as { sidebar: Record<string, string> };
            expect(maps.sidebar.openSheetCountShort_one).toContain('{{count}}');
            expect(maps.sidebar.openSheetCountShort_other).toContain('{{count}}');
            expect(maps.sidebar.openSheetCountShort_other).not.toMatch(/^(Ver|View)\b/);
        }
        const page = read('pages/[lang]/alojamientos/mapa.astro');
        expect(page).toContain("t('maps.sidebar.openSheetCountShort_one'");
        expect(page).toContain("t('maps.sidebar.openSheetCountShort_other'");
    });
});
