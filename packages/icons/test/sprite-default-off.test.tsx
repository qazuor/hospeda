/**
 * @file sprite-default-off.test.tsx
 * @description The apps/admin guarantee: sprite mode is OFF until a consumer
 * turns it on (HOS-369 W3-6).
 *
 * ## Why this is its own file
 *
 * The property under test is the module's DEFAULT state, and nothing else here
 * may disturb it. `sprite.test.tsx` cannot assert it: that file calls
 * `setIconSpriteBase` and resets it in `afterEach`, so by the time any of its
 * tests observe "no base", the base was EXPLICITLY set to `null` — which passes
 * just as happily if the module shipped with a base baked in. That exact
 * mutation (initialising `spriteBase` to a URL) was applied and `sprite.test.tsx`
 * stayed green.
 *
 * So: this file calls no setter, at all. If sprite mode ever becomes on-by-
 * default, `apps/admin` starts emitting `<use href>` at a URL it does not serve,
 * every icon in the admin renders as nothing, and no admin test would notice —
 * this is the only place that would.
 */

import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { HomeIcon, StarIcon } from '../src';
import { getIconSpriteBase, SPRITE_WEIGHTS } from '../src/sprite';

/** Renders an icon and returns its root `<svg>`. */
function renderIcon(node: ReactElement): SVGSVGElement {
    const { container } = render(node);
    const svg = container.querySelector('svg');
    if (svg === null) throw new Error('no <svg> rendered');
    return svg;
}

describe('a consumer that configures nothing (apps/admin)', () => {
    it('sees sprite mode off out of the box', () => {
        expect(
            getIconSpriteBase(),
            'sprite mode must be OFF by default — apps/admin has no sprite endpoint, and a <use href> at a URL that 404s renders nothing, silently'
        ).toBeNull();
    });

    it('gets the glyph inlined, exactly as before, at every shipped weight', () => {
        // Every shipped weight, because those are the ones that WOULD switch to
        // `<use>`. Checking only `thin` would pass on a weight the sprite never
        // ships and prove nothing.
        for (const weight of SPRITE_WEIGHTS) {
            const svg = renderIcon(<StarIcon weight={weight} />);

            expect(svg.querySelector('use'), weight).toBeNull();
            expect(svg.querySelectorAll('path').length, weight).toBeGreaterThan(0);
        }
    });

    it('keeps the Phosphor attributes it always emitted', () => {
        // A silent switch to the sprite branch would also drop `viewBox` and
        // `xmlns`, which the inline form carries and consumers may rely on.
        const svg = renderIcon(<HomeIcon weight="duotone" />);

        expect(svg.getAttribute('viewBox')).toBe('0 0 256 256');
        expect(svg.getAttribute('fill')).toBe('#1A5FB4');
    });
});
