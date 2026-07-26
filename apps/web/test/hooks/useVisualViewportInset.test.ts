/**
 * @file useVisualViewportInset.test.ts
 * @description Tests for the visual-viewport tracker behind the chat panel's
 * keyboard handling (HOS-309).
 *
 * jsdom has no `visualViewport`, so one is installed here. That is also the
 * fallback path the hook has to survive: older browsers and SSR see exactly
 * the same absence.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisualViewportInset } from '../../src/hooks/useVisualViewportInset';

const LAYOUT_HEIGHT = 844;

interface FakeViewport {
    height: number;
    offsetTop: number;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
}

let viewport: FakeViewport;
let listeners: Record<string, Array<() => void>>;

function installViewport(): void {
    listeners = {};
    viewport = {
        height: LAYOUT_HEIGHT,
        offsetTop: 0,
        addEventListener: vi.fn((type: string, fn: () => void) => {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(fn);
        }),
        removeEventListener: vi.fn((type: string, fn: () => void) => {
            listeners[type] = (listeners[type] ?? []).filter((l) => l !== fn);
        })
    };
    Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: viewport
    });
    Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: LAYOUT_HEIGHT
    });
}

/** Simulates the virtual keyboard taking the bottom `px` of the screen. */
function openKeyboard(px: number): void {
    viewport.height = LAYOUT_HEIGHT - px;
    for (const fn of listeners.resize ?? []) fn();
}

describe('useVisualViewportInset', () => {
    beforeEach(installViewport);

    afterEach(() => {
        Reflect.deleteProperty(window, 'visualViewport');
    });

    it('reports no inset while the keyboard is closed', () => {
        const { result } = renderHook(() => useVisualViewportInset({ enabled: true }));

        expect(result.current).toEqual({ height: LAYOUT_HEIGHT, bottomInset: 0 });
    });

    it('reports the keyboard height as a bottom inset', () => {
        const { result } = renderHook(() => useVisualViewportInset({ enabled: true }));

        act(() => openKeyboard(336));

        // This is the number `100vh` can never give: the layout viewport is
        // still 844 with the keyboard up.
        expect(result.current).toEqual({ height: 508, bottomInset: 336 });
    });

    it('accounts for a visual viewport scrolled within the layout one (iOS)', () => {
        const { result } = renderHook(() => useVisualViewportInset({ enabled: true }));

        act(() => {
            viewport.height = 508;
            viewport.offsetTop = 60;
            for (const fn of listeners.scroll ?? []) fn();
        });

        // 844 - 508 - 60. Ignoring `offsetTop` would over-report by 60px and
        // float the panel above the keyboard.
        expect(result.current.bottomInset).toBe(276);
    });

    it('does nothing until enabled, and stops when disabled', () => {
        const { result, rerender } = renderHook(
            ({ enabled }) => useVisualViewportInset({ enabled }),
            { initialProps: { enabled: false } }
        );

        expect(result.current).toEqual({ height: null, bottomInset: 0 });
        expect(viewport.addEventListener).not.toHaveBeenCalled();

        rerender({ enabled: true });
        expect(viewport.addEventListener).toHaveBeenCalledTimes(2);

        rerender({ enabled: false });
        expect(viewport.removeEventListener).toHaveBeenCalledTimes(2);
        expect(result.current).toEqual({ height: null, bottomInset: 0 });
    });

    it('degrades to no inset when the browser lacks visualViewport', () => {
        Reflect.deleteProperty(window, 'visualViewport');

        const { result } = renderHook(() => useVisualViewportInset({ enabled: true }));

        // Callers fall back to `dvh` in CSS rather than branching.
        expect(result.current).toEqual({ height: null, bottomInset: 0 });
    });

    it('never reports a negative inset', () => {
        const { result } = renderHook(() => useVisualViewportInset({ enabled: true }));

        // Pinch-zoom can make the visual viewport taller than the layout one.
        act(() => openKeyboard(-200));

        expect(result.current.bottomInset).toBe(0);
    });
});
