/**
 * Tests for syncTabScrollFade (HOS-2610 F-24).
 */

import { describe, expect, it } from 'vitest';
import { syncTabScrollFade } from '@/lib/ui/tab-scroll-fade';

function barWith({
    scrollWidth,
    clientWidth,
    scrollLeft
}: {
    readonly scrollWidth: number;
    readonly clientWidth: number;
    readonly scrollLeft: number;
}): HTMLElement {
    const bar = document.createElement('div');
    Object.defineProperty(bar, 'scrollWidth', { value: scrollWidth });
    Object.defineProperty(bar, 'clientWidth', { value: clientWidth });
    Object.defineProperty(bar, 'scrollLeft', { value: scrollLeft, writable: true });
    return bar;
}

describe('syncTabScrollFade', () => {
    it('fades nothing when every tab fits', () => {
        const bar = barWith({ scrollWidth: 300, clientWidth: 300, scrollLeft: 0 });
        syncTabScrollFade({ bar });
        expect(bar.dataset.fadeStart).toBe('false');
        expect(bar.dataset.fadeEnd).toBe('false');
    });

    it('fades only the end when overflowing from the start', () => {
        const bar = barWith({ scrollWidth: 600, clientWidth: 300, scrollLeft: 0 });
        syncTabScrollFade({ bar });
        expect(bar.dataset.fadeStart).toBe('false');
        expect(bar.dataset.fadeEnd).toBe('true');
    });

    it('fades both edges in the middle', () => {
        const bar = barWith({ scrollWidth: 600, clientWidth: 300, scrollLeft: 100 });
        syncTabScrollFade({ bar });
        expect(bar.dataset.fadeStart).toBe('true');
        expect(bar.dataset.fadeEnd).toBe('true');
    });

    it('fades only the start once the end is reached', () => {
        const bar = barWith({ scrollWidth: 600, clientWidth: 300, scrollLeft: 300 });
        syncTabScrollFade({ bar });
        expect(bar.dataset.fadeStart).toBe('true');
        expect(bar.dataset.fadeEnd).toBe('false');
    });
});
