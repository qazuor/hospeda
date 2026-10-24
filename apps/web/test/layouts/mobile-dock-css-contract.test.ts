/**
 * @module test/layouts/mobile-dock-css-contract
 * @description HOS-1768 regressions. The older dock tests regex the source for
 * strings, which let three rendered bugs ship green. These parse the real
 * style blocks and assert the CSS contract (which rule applies on mobile).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../src');
const read = (path: string): string => readFileSync(resolve(SRC, path), 'utf8');

const MOBILE_QUERY = '(max-width: 767px)';

interface ParsedRule {
    /** Selector with `:global(...)` unwrapped, whitespace collapsed. */
    readonly selector: string;
    /** True when the rule sits (at any depth) inside the mobile media query. */
    readonly mobile: boolean;
    readonly decls: Readonly<Record<string, string>>;
    /** Source order, to assert "declared after". */
    readonly order: number;
}

/** Extracts the first `<style>` block of an .astro file, or returns plain CSS as is. */
function styleOf(source: string): string {
    return source.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? source;
}

/** Flat parse of CSS rules, tracking whether each one is inside the mobile query. */
function parseRules(css: string): ParsedRule[] {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules: ParsedRule[] = [];
    let order = 0;
    const walk = (text: string, mobile: boolean): void => {
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
                walk(body, mobile || head.includes(MOBILE_QUERY));
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
                    rules.push({ selector, mobile, decls, order: order++ });
                }
            }
            i = j;
        }
    };
    walk(clean, false);
    return rules;
}

const dockRules = parseRules(styleOf(read('components/shared/dock/MobileDock.astro')));
const scrollRules = parseRules(styleOf(read('components/shared/navigation/ScrollToTop.astro')));
const cardsRules = parseRules(read('components/maps/MapCardsSidebar.module.css'));

/** Last declared value of `prop` for `selector` among mobile rules, in source order. */
function mobileValue(
    rules: readonly ParsedRule[],
    selector: string,
    prop: string
): string | undefined {
    return rules
        .filter((r) => r.mobile && r.selector === selector && prop in r.decls)
        .sort((a, b) => a.order - b.order)
        .map((r) => r.decls[prop])
        .at(-1);
}

describe('HOS-1768 dock CSS contract (rendered behaviour, not source strings)', () => {
    const START = '[data-mobile-dock-slot="start"]';

    it('hides the start slot on desktop but un-hides it inside the mobile query', () => {
        const base = dockRules.filter((r) => !r.mobile && r.selector === START);
        expect(base.at(-1)?.decls.display).toBe('none');
        // Bug 1: nothing re-showed the slot on mobile, so Lista/Mapa never rendered.
        const mobile = mobileValue(dockRules, START, 'display');
        expect(mobile).toBeDefined();
        expect(mobile).not.toBe('none');
    });

    it('declares the mobile start-slot rule after the desktop one so it wins the cascade', () => {
        const base = dockRules.filter((r) => !r.mobile && r.selector === START).at(-1);
        const mobile = dockRules.filter((r) => r.mobile && r.selector === START).at(-1);
        expect(mobile && base && mobile.order > base.order).toBe(true);
    });

    it('makes the scroll-to-top button the containing block of its ring on mobile', () => {
        // Bug 3: `static` made the absolute ring anchor to the fixed dock. The
        // component's own scoped mobile rule outranks the dock's :global one, so
        // neither may say static.
        for (const rules of [dockRules, scrollRules]) {
            expect(mobileValue(rules, '.scroll-to-top', 'position')).not.toBe('static');
        }
        expect([
            mobileValue(scrollRules, '.scroll-to-top', 'position'),
            mobileValue(dockRules, '.scroll-to-top', 'position')
        ]).toContain('relative');
    });

    it('keeps the ring absolutely positioned (it relies on the button being positioned)', () => {
        const ring = scrollRules.find((r) => r.selector === '.scroll-to-top__ring-svg');
        expect(ring?.decls.position).toBe('absolute');
    });

    it('shows the map-cards trigger again inside the dock on mobile', () => {
        // Bug 2b: the mobile media query hides .sheetTrigger and the dock override
        // only reset position, so the trigger stayed display:none in the dock.
        expect(mobileValue(cardsRules, '.sheetTrigger', 'display')).toBe('none');
        const inDock = mobileValue(cardsRules, '[data-mobile-dock] .sheetTrigger', 'display');
        expect(inDock).toBeDefined();
        expect(inDock).not.toBe('none');
    });
});

describe('HOS-1768 mapa.astro routes the dock toggle into the dock slot', () => {
    const map = read('pages/[lang]/alojamientos/mapa.astro');

    it('never nests the slotted dock toggle in a bare <> fragment', () => {
        // Bug 2a: Astro ignores `slot` on children of `<>`, so the toggle fell into
        // the default slot (page content, inside data-listing-swap="content").
        const fragments = [...map.matchAll(/<>([\s\S]*?)<\/>/g)].map((m) => m[1] ?? '');
        for (const body of fragments) {
            expect(body).not.toContain('slot="dock-start"');
        }
        expect(map).toMatch(/<ListingViewToggle\b[^>]*slot="dock-start"[^>]*variant="dock"/);
    });
});
