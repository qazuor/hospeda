/**
 * @module test/layouts/mobile-dock-single-row-contract
 * @description HOS-1780 regressions. Below 400px the mobile dock row used to
 * wrap its round buttons onto a second line (dock height ~64 -> ~123px). The
 * owner decision is: compact spacing below 400px, and an icon-only Filtros
 * trigger at 360px and below. Widths cannot be computed from CSS, so these
 * parse the cascade and pin the declarations that make the row fit; the real
 * rendered widths were measured in a headless browser (see the HOS-1780 PR).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../src');
const read = (path: string): string => readFileSync(resolve(SRC, path), 'utf8');

const COMPACT = 'max-width: 399px';
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

describe('HOS-1780 compact dock below 400px', () => {
    it('tightens the row gap and lateral padding below the base values', () => {
        const baseGap = dock
            .filter(
                (r) =>
                    r.selector === '.mobile-dock__row' && !inQuery(r, COMPACT) && 'gap' in r.decls
            )
            .map((r) => r.decls.gap)
            .at(-1);
        expect(baseGap).toBe('var(--space-2)');
        expect(valueUnder(dock, '.mobile-dock__row', COMPACT, 'gap')).toBe('var(--space-1)');
        // The base padding is the `--space-container-x` clamp (12px on phones).
        expect(valueUnder(dock, '.mobile-dock__row', COMPACT, 'padding-inline')).toBe(
            'var(--space-2)'
        );
    });

    it('declares the compact row rule after the base rules so it wins the cascade', () => {
        const compact = under(dock, '.mobile-dock__row', COMPACT).at(-1);
        const base = dock.filter((r) => r.selector === '.mobile-dock__row' && !inQuery(r, COMPACT));
        expect(compact).toBeDefined();
        for (const rule of base) expect(compact && compact.order > rule.order).toBe(true);
    });

    it('tightens the gaps inside the start and end groups', () => {
        for (const sel of ['.mobile-dock__start', '.mobile-dock__end']) {
            expect(valueUnder(dock, sel, COMPACT, 'gap')).toBe('var(--space-1)');
        }
        const pill = valueUnder(dock, '.mobile-dock__start:has([data-dock-item])', COMPACT, 'gap');
        expect(pill).toBe('2px');
    });

    it('never wraps the row to a second line by relying on flex-wrap alone', () => {
        // The row keeps flex-wrap as a safety net for content that genuinely
        // cannot fit (e.g. the map view CTA), but the compact query must not
        // re-introduce larger spacing.
        expect(valueUnder(dock, '.mobile-dock__row', COMPACT, 'flex-wrap')).toBeUndefined();
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

    it('compacts the Filtros trigger below 400px and guarantees its 44px height', () => {
        expect(valueUnder(filters, DOCK_TRIGGER, '(max-width: 767px)', 'min-height')).toBe('44px');
        const compact = valueUnder(filters, DOCK_TRIGGER, COMPACT, 'padding');
        expect(compact).toBe('0.75rem 0.75rem');
        // Declared after the dock rule it overrides (same specificity).
        const base = under(filters, DOCK_TRIGGER, '(max-width: 767px)').find(
            (r) => 'padding' in r.decls
        );
        const tight = under(filters, DOCK_TRIGGER, COMPACT).find((r) => 'padding' in r.decls);
        expect(base && tight && tight.order > base.order).toBe(true);
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
