/**
 * @file sprite-symbol-membership.test.tsx
 * @description Tests for the (glyph name, weight) PAIR fail-safe on top of the
 * external-sprite mode (HOS-369 sprite-subsetting groundwork).
 *
 * `isSpriteWeight` already guards the WEIGHT axis: a weight the sprite does not
 * ship falls back to inline rendering instead of an empty `<use>`.
 * `hasIconSpriteSymbol` extends the same fail-safe to the PAIR axis, which
 * matters once a later change ships a SUBSET sprite where a glyph can be
 * missing a symbol at one particular weight even though the weight itself is
 * shipped for other glyphs.
 *
 * The single most important property here is the PERMISSIVE DEFAULT: with no
 * manifest configured anywhere, every pair must read as present. Inverting
 * that default silently inlines every icon on every page — see
 * `hasIconSpriteSymbol`'s JSDoc in `../src/sprite.ts` for why, and the
 * dedicated guard describe block below for the test that pins it.
 */

import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { HomeIcon, StarIcon } from '../src';
import {
    getIconSpriteBase,
    getIconSpriteName,
    hasIconSpriteSymbol,
    ICON_SPRITE_GLOBAL,
    ICON_SPRITE_SYMBOLS_GLOBAL,
    iconSymbolId,
    setIconSpriteBase,
    setIconSpriteSymbols
} from '../src/sprite';

const BASE = '/icons/sprite.9f3a1c07.svg';
const STAR_DUOTONE = iconSymbolId({ name: 'StarIcon', weight: 'duotone' });
const STAR_FILL = iconSymbolId({ name: 'StarIcon', weight: 'fill' });

/** Renders an icon and returns its root `<svg>`. */
function renderIcon(node: ReactElement): SVGSVGElement {
    const { container } = render(node);
    const svg = container.querySelector('svg');
    if (svg === null) throw new Error('no <svg> rendered');
    return svg;
}

afterEach(() => {
    // Both are module-level singletons; leaking either would silently change
    // every later test in this worker, including in other files in the run.
    setIconSpriteBase(null);
    setIconSpriteSymbols({ symbols: null });
    delete (globalThis as Record<string, unknown>)[ICON_SPRITE_GLOBAL];
    delete (globalThis as Record<string, unknown>)[ICON_SPRITE_SYMBOLS_GLOBAL];
});

describe('hasIconSpriteSymbol', () => {
    it('is permissive when no manifest is configured anywhere', () => {
        expect(hasIconSpriteSymbol({ symbol: STAR_DUOTONE })).toBe(true);
        expect(hasIconSpriteSymbol({ symbol: 'AnyGlyphAtAll-anyWeight' })).toBe(true);
    });

    it('reports a pair the manifest lists as present', () => {
        setIconSpriteSymbols({ symbols: [STAR_DUOTONE, STAR_FILL] });

        expect(hasIconSpriteSymbol({ symbol: STAR_DUOTONE })).toBe(true);
    });

    it('reports a pair the manifest does not list as absent', () => {
        setIconSpriteSymbols({ symbols: [STAR_DUOTONE] });

        expect(hasIconSpriteSymbol({ symbol: STAR_FILL })).toBe(false);
    });

    it('lets an explicit setter win over the global', () => {
        // Mirrors getIconSpriteBase's resolution order exactly: the server's
        // own explicit setting must not be overridden by a stale or wrong
        // value some other script assigned on the global.
        (globalThis as Record<string, unknown>)[ICON_SPRITE_SYMBOLS_GLOBAL] = [STAR_FILL];
        setIconSpriteSymbols({ symbols: [STAR_DUOTONE] });

        expect(hasIconSpriteSymbol({ symbol: STAR_DUOTONE })).toBe(true);
        expect(hasIconSpriteSymbol({ symbol: STAR_FILL })).toBe(false);
    });

    it('reads the manifest off the global the HTML shell would assign', () => {
        (globalThis as Record<string, unknown>)[ICON_SPRITE_SYMBOLS_GLOBAL] = [STAR_DUOTONE];

        expect(hasIconSpriteSymbol({ symbol: STAR_DUOTONE })).toBe(true);
        expect(hasIconSpriteSymbol({ symbol: STAR_FILL })).toBe(false);
    });

    it('ignores a global that is not a usable array', () => {
        for (const bogus of ['', 42, null, {}]) {
            (globalThis as Record<string, unknown>)[ICON_SPRITE_SYMBOLS_GLOBAL] = bogus;
            expect(hasIconSpriteSymbol({ symbol: STAR_DUOTONE }), String(bogus)).toBe(true);
        }
    });

    it('clears the explicit setting back to permissive when passed null', () => {
        setIconSpriteSymbols({ symbols: [STAR_DUOTONE] });
        expect(hasIconSpriteSymbol({ symbol: STAR_FILL })).toBe(false);

        setIconSpriteSymbols({ symbols: null });

        expect(hasIconSpriteSymbol({ symbol: STAR_FILL })).toBe(true);
    });

    it('re-derives its cache when the global is reassigned to a different array', () => {
        // The Set is memoized off the global's own array identity so repeated
        // lookups do not rescan it — but a later reassignment (a fresh
        // manifest published on a later deploy, in a test the same worker)
        // must not read the stale cached Set.
        (globalThis as Record<string, unknown>)[ICON_SPRITE_SYMBOLS_GLOBAL] = [STAR_DUOTONE];
        expect(hasIconSpriteSymbol({ symbol: STAR_FILL })).toBe(false);

        (globalThis as Record<string, unknown>)[ICON_SPRITE_SYMBOLS_GLOBAL] = [STAR_FILL];

        expect(hasIconSpriteSymbol({ symbol: STAR_FILL })).toBe(true);
        expect(hasIconSpriteSymbol({ symbol: STAR_DUOTONE })).toBe(false);
    });
});

describe('the wrapper obeys the manifest', () => {
    it('renders <use> when the symbol is in the manifest', () => {
        setIconSpriteBase(BASE);
        setIconSpriteSymbols({ symbols: [STAR_DUOTONE] });

        const svg = renderIcon(<StarIcon weight="duotone" />);

        expect(svg.querySelector('use')?.getAttribute('href')).toBe(`${BASE}#${STAR_DUOTONE}`);
        expect(svg.querySelector('path')).toBeNull();
    });

    it('renders inline — a real <svg> with path children, no <use> — when the symbol is missing from the manifest', () => {
        setIconSpriteBase(BASE);
        // The manifest lists a DIFFERENT pair, so StarIcon-duotone is a miss.
        setIconSpriteSymbols({ symbols: ['SomeOtherGlyph-duotone'] });

        const svg = renderIcon(<StarIcon weight="duotone" />);

        expect(svg.querySelector('use')).toBeNull();
        expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
    });

    it('base configured + NO manifest ⇒ still <use> — this PR changes nothing', () => {
        // This is the whole point of the permissive default: every consumer
        // that existed before this PR configures a base and never touches
        // `setIconSpriteSymbols`, and must keep referencing the sprite exactly
        // as before.
        setIconSpriteBase(BASE);
        const homeSpriteName = getIconSpriteName(HomeIcon);
        if (homeSpriteName === null) throw new Error('HomeIcon is not a marked sprite wrapper');

        const svg = renderIcon(<HomeIcon weight="fill" />);

        expect(svg.querySelector('use')?.getAttribute('href')).toBe(
            `${BASE}#${iconSymbolId({ name: homeSpriteName, weight: 'fill' })}`
        );
    });
});

describe('static guard: the permissive default must never invert', () => {
    // Isolated from the describe blocks above on purpose: this is the ONE
    // property whose inversion is silent and catastrophic — see
    // `hasIconSpriteSymbol`'s JSDoc. A future reader "fixing" what looks like
    // a fail-open here would inline every icon `@repo/icons` renders, in both
    // `apps/web` and `apps/admin`, with no error anywhere.
    it('reads every pair as present when nothing configured a manifest', () => {
        expect(getIconSpriteBase(), 'sanity: no base leaking from a prior test').toBeNull();

        expect(
            hasIconSpriteSymbol({ symbol: 'NoSuchGlyph-noSuchWeight' }),
            'hasIconSpriteSymbol must default to true with no manifest configured — see its JSDoc for why the opposite default is catastrophic'
        ).toBe(true);
    });
});
