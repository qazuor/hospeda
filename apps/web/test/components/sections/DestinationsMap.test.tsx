/**
 * @file DestinationsMap.test.tsx
 * @description Regression tests for the interactive destinations map.
 *
 * BETA-109: two geographically close pins (Colón, main + Liebig, secondary)
 * overlapped, and the higher z-index main pin swallowed the smaller pin's
 * clicks. The fix resolves every pointer event to the NEAREST clickable dot via
 * a single handler on the pins layer, so overlaps can no longer steal a click.
 *
 * A second root cause: the Liebig pin used slug `liebig`, but its destination's
 * real slug is `pueblo-liebig` (derived from "Pueblo Liebig"), so the pin never
 * matched a destination and stayed unclickable regardless of the overlap. These
 * tests bind the pin to the `pueblo-liebig` destination to guard both fixes.
 */
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationsMap } from '../../../src/components/sections/DestinationsMap';
import type { DestinationCardData } from '../../../src/data/types';

// Identity-proxy the CSS module so class names equal their keys (`pinsLayer`).
vi.mock('../../../src/components/sections/DestinationsMap.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// The bridge markers are decorative; stub the icon to keep the render light.
vi.mock('@repo/icons', () => ({ BridgeIcon: () => null }));

// Only Colón and Liebig carry destination data → only those two are clickable,
// which isolates the exact overlap the bug was about. Order fixes the indices:
// colón = 0, liebig = 1. Liebig's slug MUST be `pueblo-liebig` to match the map
// pin — using `liebig` here (the old, mismatched value) would leave the pin
// unclickable and fail the selection assertions below.
const destinations = [
    { slug: 'colon', name: 'Colón' },
    { slug: 'pueblo-liebig', name: 'Liebig' }
] as unknown as DestinationCardData[];

/**
 * Force the pins layer to report a 616×793 box at the origin, so a click at
 * (clientX, clientY) maps 1:1 onto the design-space pin coordinates.
 */
function stubLayerRect(container: HTMLElement): HTMLElement {
    const layer = container.querySelector('.pinsLayer') as HTMLElement;
    layer.getBoundingClientRect = vi.fn(
        () =>
            ({
                left: 0,
                top: 0,
                width: 616,
                height: 793,
                right: 616,
                bottom: 793,
                x: 0,
                y: 0,
                toJSON: () => ({})
            }) as DOMRect
    );
    return layer;
}

describe('DestinationsMap — proximity click resolution (BETA-109)', () => {
    let onSelect: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onSelect = vi.fn();
    });

    // Design-space coordinates (from CITIES): Colón (355, 380), Liebig (351, 337),
    // ~43 units apart — the pair that overlapped.
    it('selects Liebig (not the overlapping Colón) when clicking on the Liebig dot', () => {
        const { container } = render(
            <DestinationsMap
                activeIndex={0}
                onSelectDestination={onSelect}
                destinations={destinations}
            />
        );
        const layer = stubLayerRect(container);

        fireEvent.click(layer, { clientX: 351, clientY: 337 });

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith(1); // liebig index, NOT colón (0)
    });

    it('selects Colón when clicking on the Colón dot', () => {
        const { container } = render(
            <DestinationsMap
                activeIndex={1}
                onSelectDestination={onSelect}
                destinations={destinations}
            />
        );
        const layer = stubLayerRect(container);

        fireEvent.click(layer, { clientX: 355, clientY: 380 });

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith(0);
    });

    it('selects nothing when clicking far from every clickable pin', () => {
        const { container } = render(
            <DestinationsMap
                activeIndex={0}
                onSelectDestination={onSelect}
                destinations={destinations}
            />
        );
        const layer = stubLayerRect(container);

        // Open area well beyond MAX_HIT_RADIUS from both Colón and Liebig.
        fireEvent.click(layer, { clientX: 120, clientY: 700 });

        expect(onSelect).not.toHaveBeenCalled();
    });

    it('still selects via direct keyboard activation of a focused pin', () => {
        const { getByRole } = render(
            <DestinationsMap
                activeIndex={0}
                onSelectDestination={onSelect}
                destinations={destinations}
            />
        );

        // A keyboard Enter dispatches a click on the focused button itself; that
        // path selects the pin directly (independent of proximity).
        fireEvent.click(getByRole('button', { name: 'View destination Liebig' }));

        expect(onSelect).toHaveBeenCalledWith(1);
    });
});
