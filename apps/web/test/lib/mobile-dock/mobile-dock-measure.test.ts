/** @module test/lib/mobile-dock/mobile-dock-measure */
import { describe, expect, it, vi } from 'vitest';
import {
    initMobileDock,
    resolveDockHeight
} from '../../../src/lib/mobile-dock/mobile-dock-measure';

describe('TEST:1768:3 resolveDockHeight', () => {
    it('returns zero on desktop', () => {
        expect(
            resolveDockHeight({ isMobile: false, hasVisibleItem: true, measuredHeight: 40 })
        ).toEqual({ heightPx: 0 });
    });

    it('returns zero on mobile when no dock item is visible', () => {
        expect(
            resolveDockHeight({ isMobile: true, hasVisibleItem: false, measuredHeight: 40 })
        ).toEqual({ heightPx: 0 });
    });

    it('rounds a visible dock height up to the next pixel', () => {
        expect(
            resolveDockHeight({ isMobile: true, hasVisibleItem: true, measuredHeight: 40.2 })
        ).toEqual({ heightPx: 41 });
    });

    it('clamps a negative measured height to zero', () => {
        expect(
            resolveDockHeight({ isMobile: true, hasVisibleItem: true, measuredHeight: -4 })
        ).toEqual({ heightPx: 0 });
    });
});

describe('TEST:1768:4 initMobileDock', () => {
    it('publishes height, tracks the full dock and row separately, and cleans up', async () => {
        const dock = document.createElement('div');
        dock.innerHTML =
            '<div class="mobile-dock__above" data-mobile-dock-slot="above"><button data-dock-item>above</button></div><div class="mobile-dock__row"><button data-dock-item>row</button></div>';
        const rowItem = dock.querySelector('.mobile-dock__row [data-dock-item]');
        const aboveItem = dock.querySelector('[data-mobile-dock-slot="above"] [data-dock-item]');
        vi.spyOn(rowItem as Element, 'getClientRects').mockReturnValue({
            length: 1
        } as DOMRectList);
        vi.spyOn(aboveItem as Element, 'getClientRects').mockReturnValue({
            length: 0
        } as DOMRectList);
        vi.spyOn(dock, 'getBoundingClientRect').mockReturnValue({ height: 35.2 } as DOMRect);
        const root = document.createElement('html');
        const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
        const matchMedia = vi.fn(() => media);
        const cleanup = initMobileDock({ dock, root, matchMedia });

        expect(root.style.getPropertyValue('--mobile-dock-height')).toBe('36px');
        expect(dock.hasAttribute('data-empty')).toBe(false);
        expect(dock.hasAttribute('data-row-empty')).toBe(false);

        (rowItem as HTMLButtonElement).remove();
        await Promise.resolve();
        expect(root.style.getPropertyValue('--mobile-dock-height')).toBe('0px');
        expect(dock.hasAttribute('data-empty')).toBe(true);
        expect(dock.hasAttribute('data-row-empty')).toBe(true);
        expect(vi.mocked(matchMedia)).toHaveBeenCalledOnce();
        cleanup.cleanup();
        expect(root.style.getPropertyValue('--mobile-dock-height')).toBe('');
    });

    it('counts an item outside the row for data-empty but leaves data-row-empty set', () => {
        const dock = document.createElement('div');
        dock.innerHTML =
            '<div data-mobile-dock-slot="above"><button data-dock-item>above</button></div><div class="mobile-dock__row"></div>';
        const item = dock.querySelector('[data-dock-item]');
        vi.spyOn(item as Element, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
        vi.spyOn(dock, 'getBoundingClientRect').mockReturnValue({ height: 20 } as DOMRect);
        const root = document.createElement('html');
        const cleanup = initMobileDock({
            dock,
            root,
            matchMedia: () => ({
                matches: true,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn()
            })
        });
        expect(dock.hasAttribute('data-empty')).toBe(false);
        expect(dock.hasAttribute('data-row-empty')).toBe(true);
        cleanup.cleanup();
    });
});
