/** @module test/lib/mobile-dock/mobile-dock-measure */
import { readFileSync } from 'node:fs';
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

/**
 * Owner smoke (HOS-2520): on an accommodation page with dead islands (HOS-2578), the
 * contact bar and the AI chat FAB never portal into the dock, so scrolling up revealed a
 * full-width frosted band 61px tall that held nothing but the scroll-to-top button.
 * A row whose only visible items are floating controls must not paint the band.
 */
describe('HOS-2520 floating-only dock row', () => {
    function mountRow(html: string, visible: readonly string[]) {
        const dock = document.createElement('div');
        dock.innerHTML = `<div class="mobile-dock__row">${html}</div>`;
        for (const item of dock.querySelectorAll<HTMLElement>('[data-dock-item]')) {
            const isVisible = visible.includes(item.id);
            vi.spyOn(item, 'getClientRects').mockReturnValue({
                length: isVisible ? 1 : 0
            } as DOMRectList);
        }
        vi.spyOn(dock, 'getBoundingClientRect').mockReturnValue({ height: 61 } as DOMRect);
        const root = document.createElement('html');
        const { cleanup } = initMobileDock({
            dock,
            root,
            matchMedia: () =>
                ({
                    matches: true,
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn()
                }) as unknown as MediaQueryList
        });
        return { dock, cleanup };
    }

    const ROW =
        '<div id="bar" data-dock-item>bar</div><button id="fab" data-dock-item>chat</button><button id="top" data-dock-item data-dock-floating>top</button>';

    it('flags the row as floating when scroll-to-top is the only visible item', () => {
        const { dock, cleanup } = mountRow(ROW, ['top']);
        expect(dock.hasAttribute('data-row-floating')).toBe(true);
        expect(dock.hasAttribute('data-row-empty')).toBe(false);
        cleanup();
    });

    it('keeps the band when the contact bar or the chat FAB is there too', () => {
        const withBar = mountRow(ROW, ['bar', 'top']);
        expect(withBar.dock.hasAttribute('data-row-floating')).toBe(false);
        withBar.cleanup();
        const withFab = mountRow(ROW, ['fab', 'top']);
        expect(withFab.dock.hasAttribute('data-row-floating')).toBe(false);
        withFab.cleanup();
    });

    it('is not floating when the row is empty', () => {
        const { dock, cleanup } = mountRow(ROW, []);
        expect(dock.hasAttribute('data-row-floating')).toBe(false);
        expect(dock.hasAttribute('data-row-empty')).toBe(true);
        cleanup();
    });
});

describe('HOS-2520 floating-only dock row: markup and CSS', () => {
    it('marks scroll-to-top as a floating dock item', () => {
        const src = readFileSync('src/components/shared/navigation/ScrollToTop.astro', 'utf8');
        expect(src).toMatch(/data-dock-item\s+data-dock-floating/);
    });

    it('drops the frosted band, but not the padding, for a floating-only row', () => {
        const css = readFileSync('src/components/shared/dock/MobileDock.astro', 'utf8');
        const rule =
            css.match(/\.mobile-dock\[data-row-floating\] \.mobile-dock__row \{[^}]*\}/)?.[0] ?? '';
        expect(rule).toContain('background: none;');
        expect(rule).toContain('backdrop-filter: none;');
        expect(rule).toContain('border-block-start: 0;');
        expect(rule).not.toMatch(/padding/);
    });
});
