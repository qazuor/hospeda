import { afterEach, describe, expect, it, vi } from 'vitest';
import { initComparisonScroll } from '@/components/billing/comparison-scroll';

afterEach(() => {
    document.dispatchEvent(new Event('astro:before-swap'));
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('comparison scroll affordance', () => {
    it('indicates hidden columns, clears at the end, and updates after resize', () => {
        let resize = () => {};
        const disconnect = vi.fn();
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(callback: () => void) {
                    resize = callback;
                }
                observe() {}
                disconnect = disconnect;
            }
        );
        document.body.innerHTML =
            '<div data-comparison-scroll><div data-comparison-viewport><table></table></div></div>';
        const root = document.querySelector<HTMLElement>('[data-comparison-scroll]')!;
        const viewport = root.firstElementChild as HTMLElement;
        Object.defineProperties(viewport, {
            scrollWidth: { configurable: true, value: 900 },
            clientWidth: { configurable: true, value: 350 }
        });
        initComparisonScroll();
        expect(root.dataset.scrollable).toBe('true');
        expect(root.dataset.atEnd).toBe('false');
        viewport.scrollLeft = 550;
        viewport.dispatchEvent(new Event('scroll'));
        expect(root.dataset.atEnd).toBe('true');
        viewport.scrollLeft = 0;
        Object.defineProperty(viewport, 'clientWidth', { value: 1000 });
        resize();
        expect(root.dataset.scrollable).toBe('false');
        expect(root.dataset.atEnd).toBe('true');
        document.dispatchEvent(new Event('astro:before-swap'));
        expect(disconnect).toHaveBeenCalledOnce();
    });
});
