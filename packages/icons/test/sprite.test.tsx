/**
 * @file sprite.test.tsx
 * @description Tests for the opt-in external-sprite mode of the Phosphor icon
 * wrappers (HOS-369 W3-6).
 *
 * The single most important property here is the NEGATIVE one: with no base URL
 * configured, rendering must be byte-for-byte what it has always been. This
 * package is shared with `apps/admin`, which has no sprite endpoint — a `<use>`
 * pointing at a URL that does not exist renders nothing at all, silently, and no
 * admin test would catch it because nothing in admin ever enables sprite mode.
 */

import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { BellIcon, HomeIcon, NotificationIcon, StarIcon } from '../src';
import {
    expandSpriteSymbolEntry,
    getIconSpriteBase,
    getIconSpriteName,
    ICON_SPRITE_GLOBAL,
    iconSymbolId,
    isSpriteWeight,
    SPRITE_WEIGHTS,
    setIconSpriteBase
} from '../src/sprite';

const BASE = '/icons/sprite.9f3a1c07.svg';

/** Renders an icon and returns its root `<svg>`. */
function renderIcon(node: ReactElement): SVGSVGElement {
    const { container } = render(node);
    const svg = container.querySelector('svg');
    if (svg === null) throw new Error('no <svg> rendered');
    return svg;
}

afterEach(() => {
    // Sprite mode is a module-level singleton; leaking it would silently change
    // every later test in this worker.
    setIconSpriteBase(null);
    delete (globalThis as Record<string, unknown>)[ICON_SPRITE_GLOBAL];
});

describe('SPRITE_WEIGHTS', () => {
    it('ships exactly the four weights apps/web uses', () => {
        // `thin` and `light` appear nowhere in apps/web; shipping all six would
        // cost 124,935 B brotli instead of 73,969 B for weights nothing renders.
        expect([...SPRITE_WEIGHTS]).toEqual(['regular', 'bold', 'fill', 'duotone']);
    });

    it('is the same predicate the wrapper branches on', () => {
        for (const weight of SPRITE_WEIGHTS) expect(isSpriteWeight(weight)).toBe(true);
        expect(isSpriteWeight('thin')).toBe(false);
        expect(isSpriteWeight('light')).toBe(false);
    });
});

describe('iconSymbolId', () => {
    it('round-trips the name and weight it was given', () => {
        expect(iconSymbolId({ name: 'StarIcon', weight: 'duotone' })).toBe('StarIcon-duotone');
    });

    it('separates weights of the same glyph', () => {
        const ids = SPRITE_WEIGHTS.map((weight) => iconSymbolId({ name: 'StarIcon', weight }));

        expect(new Set(ids).size).toBe(SPRITE_WEIGHTS.length);
    });
});

describe('expandSpriteSymbolEntry', () => {
    it('decodes a full id (the pre-manifest shape) to exactly one pair', () => {
        expect(expandSpriteSymbolEntry({ entry: 'StarIcon-duotone' })).toEqual([
            { name: 'StarIcon', weight: 'duotone' }
        ]);
    });

    it('round-trips a full id through iconSymbolId unchanged', () => {
        for (const weight of SPRITE_WEIGHTS) {
            const id = iconSymbolId({ name: 'SomeOtherIcon', weight });
            const [pair] = expandSpriteSymbolEntry({ entry: id });

            expect(pair, id).toBeDefined();
            expect(iconSymbolId(pair as { name: string; weight: typeof weight })).toBe(id);
        }
    });

    it('decodes a compact entry to one pair per weight initial', () => {
        expect(expandSpriteSymbolEntry({ entry: 'StarIcon:df' })).toEqual([
            { name: 'StarIcon', weight: 'duotone' },
            { name: 'StarIcon', weight: 'fill' }
        ]);
    });

    it('decodes every shipped weight initial to the weight it names', () => {
        // r/b/f/d are the first letters of regular/bold/fill/duotone — all
        // four distinct, so there is no ambiguity to test around.
        expect(expandSpriteSymbolEntry({ entry: 'X:rbfd' })).toEqual([
            { name: 'X', weight: 'regular' },
            { name: 'X', weight: 'bold' },
            { name: 'X', weight: 'fill' },
            { name: 'X', weight: 'duotone' }
        ]);
    });

    it('drops an unrecognised initial rather than throwing', () => {
        // Runs against whatever the HTML shell put on a global; a malformed
        // manifest must degrade one pair, not crash icon rendering.
        expect(expandSpriteSymbolEntry({ entry: 'X:rz' })).toEqual([
            { name: 'X', weight: 'regular' }
        ]);
    });

    it('drops a full id with no recognisable weight suffix rather than throwing', () => {
        expect(expandSpriteSymbolEntry({ entry: 'NoWeightHere' })).toEqual([]);
        expect(expandSpriteSymbolEntry({ entry: 'Some-Bogus-Weight' })).toEqual([]);
    });

    it('drops an entry with an empty name on either shape', () => {
        expect(expandSpriteSymbolEntry({ entry: ':rd' })).toEqual([]);
        expect(expandSpriteSymbolEntry({ entry: '-regular' })).toEqual([]);
    });
});

describe('getIconSpriteName', () => {
    it('names the PHOSPHOR glyph a wrapper draws, not the wrapper', () => {
        // Wrapper display names are semantic and repeat — 28 of them name more
        // than one glyph (`bell`, `calendar`, `filter`, …). Keying symbols by
        // them would make two different icons share one symbol, and one of them
        // would silently render as the other.
        expect(getIconSpriteName(StarIcon)).toBe('StarIcon');
        expect((StarIcon as { displayName?: string }).displayName).toBe('star');
    });

    it('collapses two wrappers around the same glyph onto one symbol', () => {
        // `BellIcon` and `NotificationIcon` are both `Bell`. Keying by the
        // Phosphor name is what lets the sprite carry 247 shapes for 436 exported
        // wrappers instead of one symbol per wrapper.
        expect(getIconSpriteName(NotificationIcon)).toBe(getIconSpriteName(BellIcon));
    });

    it('returns null for anything that is not a Phosphor wrapper', () => {
        expect(getIconSpriteName({})).toBeNull();
        expect(getIconSpriteName(null)).toBeNull();
        expect(getIconSpriteName('StarIcon')).toBeNull();
    });
});

describe('with the base explicitly cleared', () => {
    // NOT the apps/admin guarantee — that is about the module's DEFAULT state,
    // which this file cannot observe once its own `afterEach` has run a setter.
    // `sprite-default-off.test.tsx` owns that property, in isolation.
    it('renders the glyph inline', () => {
        setIconSpriteBase(null);

        const svg = renderIcon(<StarIcon weight="fill" />);

        expect(svg.querySelector('use')).toBeNull();
        expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
    });

    it('keeps Phosphor rendering for every shipped weight', () => {
        // Non-vacuity for the test above: it must hold for the weights that
        // WOULD switch to `<use>`, not only for a weight the sprite never ships.
        setIconSpriteBase(null);

        for (const weight of SPRITE_WEIGHTS) {
            const svg = renderIcon(<HomeIcon weight={weight} />);
            expect(svg.querySelector('use'), weight).toBeNull();
        }
    });
});

describe('with a sprite base configured', () => {
    it('references the sprite instead of inlining the glyph', () => {
        setIconSpriteBase(BASE);

        const svg = renderIcon(<StarIcon weight="fill" />);
        const use = svg.querySelector('use');

        expect(use?.getAttribute('href')).toBe(`${BASE}#StarIcon-fill`);
        expect(svg.querySelector('path')).toBeNull();
    });

    it('builds the href with the SAME id helper the generator uses', () => {
        setIconSpriteBase(BASE);

        const svg = renderIcon(<StarIcon weight="duotone" />);

        expect(svg.querySelector('use')?.getAttribute('href')).toBe(
            `${BASE}#${iconSymbolId({ name: 'StarIcon', weight: 'duotone' })}`
        );
    });

    it('keeps fill on the host <svg> so currentColor still resolves', () => {
        // `fill` is inherited and inherited properties DO cross into the `<use>`
        // shadow tree — that is the whole reason external symbols can be themed.
        // Dropping it leaves every icon black.
        setIconSpriteBase(BASE);

        expect(renderIcon(<StarIcon weight="regular" />).getAttribute('fill')).toBe('currentColor');
    });

    it('keeps the duotone brand color, unchanged from the inline behaviour', () => {
        setIconSpriteBase(BASE);

        expect(renderIcon(<StarIcon weight="duotone" />).getAttribute('fill')).toBe('#1A5FB4');
    });

    it('keeps size, class and aria-label on the host <svg>', () => {
        setIconSpriteBase(BASE);

        const svg = renderIcon(
            <StarIcon
                size="lg"
                className="c"
                aria-label="Favorito"
            />
        );

        expect(svg.getAttribute('width')).toBe('28');
        expect(svg.getAttribute('height')).toBe('28');
        expect(svg.getAttribute('class')).toBe('c');
        expect(svg.getAttribute('aria-label')).toBe('Favorito');
    });

    it('renders inline for a weight the sprite does not ship', () => {
        // A `<use>` for `thin` would point at a symbol that was never generated
        // and render nothing. Falling back is correct — just heavier, which is
        // what the apps/web static guard exists to keep from happening quietly.
        setIconSpriteBase(BASE);

        for (const weight of ['thin', 'light'] as const) {
            const svg = renderIcon(<StarIcon weight={weight} />);
            expect(svg.querySelector('use'), weight).toBeNull();
            expect(svg.querySelectorAll('path').length, weight).toBeGreaterThan(0);
        }
    });

    it('renders inline when mirrored', () => {
        // Phosphor mirrors by transforming the GLYPH's own children, which a
        // shared symbol cannot carry per instance.
        setIconSpriteBase(BASE);

        expect(
            renderIcon(
                <StarIcon
                    weight="fill"
                    mirrored
                />
            ).querySelector('use')
        ).toBeNull();
    });

    it('goes back to inline when the base is cleared and no global supplies one', () => {
        setIconSpriteBase(BASE);
        setIconSpriteBase(null);

        expect(renderIcon(<StarIcon weight="fill" />).querySelector('use')).toBeNull();
    });
});

describe('the browser hand-off', () => {
    it('picks the base up from the global the HTML shell emits', () => {
        // Islands render in a realm where `setIconSpriteBase` was never called.
        // Without this read they would hydrate icons INLINE over server-rendered
        // `<use>` markup — a mismatch on every icon inside an island.
        (globalThis as Record<string, unknown>)[ICON_SPRITE_GLOBAL] = BASE;

        expect(getIconSpriteBase()).toBe(BASE);
        expect(renderIcon(<StarIcon weight="fill" />).querySelector('use')).not.toBeNull();
    });

    it('lets an explicit setting win over the global', () => {
        // The server sets its own base at boot; a stale or wrong global must not
        // be able to point SSR at a different sprite than the one this process
        // serves.
        (globalThis as Record<string, unknown>)[ICON_SPRITE_GLOBAL] = '/icons/sprite.deadbeef.svg';
        setIconSpriteBase(BASE);

        expect(getIconSpriteBase()).toBe(BASE);
    });

    it('ignores a global that is not a usable URL', () => {
        for (const bogus of ['', 42, null, {}]) {
            (globalThis as Record<string, unknown>)[ICON_SPRITE_GLOBAL] = bogus;
            expect(getIconSpriteBase(), String(bogus)).toBeNull();
        }
    });
});
