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
/** Restored in afterEach so a stubbed viewport cannot outlive its test. */
let originalInnerHeight: PropertyDescriptor | undefined;

function installViewport(): void {
    originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
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
        if (originalInnerHeight) {
            Object.defineProperty(window, 'innerHeight', originalInnerHeight);
        } else {
            Reflect.deleteProperty(window, 'innerHeight');
        }
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

    describe('settle safety-net remeasures (HOS-309 / HOS-138)', () => {
        // jsdom has no real virtual keyboard, so it cannot reproduce the actual
        // race (a `visualViewport.resize` event dropped or delayed around the
        // very first IME activation on a fresh page — see the hook's own doc on
        // `SETTLE_REMEASURE_DELAYS_MS`). What CAN be tested deterministically is
        // the pure resilience mechanism: if the viewport's height changes WITHOUT
        // its `resize` listener ever firing (simulating exactly that dropped
        // event), does the hook still converge on the correct measurement on its
        // own, without requiring the caller to re-open/re-focus? This is a
        // guarantee about the hook's own logic, not proof the real-device race is
        // fixed — that part remains unverified by automated tests, honestly.
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('converges on the settled height even when the resize event never fires', () => {
            const { result } = renderHook(() => useVisualViewportInset({ enabled: true }));

            // Precondition: the synchronous first measure ran before the
            // (simulated) keyboard opened, so it read the full layout height.
            expect(result.current).toEqual({ height: LAYOUT_HEIGHT, bottomInset: 0 });

            // The keyboard "settles" here, but — reproducing the dropped-event
            // race — nothing calls the `resize` listener.
            act(() => {
                viewport.height = LAYOUT_HEIGHT - 336;
            });
            // No listener fired, so the stale measurement is still what the
            // hook reports — this is the exact bug: nothing corrects it yet.
            expect(result.current).toEqual({ height: LAYOUT_HEIGHT, bottomInset: 0 });

            // Advance past the first safety-net delay (100ms).
            act(() => {
                vi.advanceTimersByTime(100);
            });
            expect(result.current).toEqual({ height: 508, bottomInset: 336 });
        });

        it('schedules exactly the three documented safety-net timers, cleared on cleanup', () => {
            const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
            const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

            const { unmount } = renderHook(() => useVisualViewportInset({ enabled: true }));

            const scheduledDelays = setTimeoutSpy.mock.calls.map(([, delay]) => delay);
            expect(scheduledDelays).toEqual([100, 300, 600]);

            unmount();
            // All three timers registered by this hook must be cleared, not
            // left to fire after the panel/component is gone.
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(3);
        });

        it('does not re-fire once every safety-net delay has already elapsed', () => {
            const { result } = renderHook(() => useVisualViewportInset({ enabled: true }));

            act(() => {
                viewport.height = LAYOUT_HEIGHT - 336;
                vi.advanceTimersByTime(600);
            });
            expect(result.current).toEqual({ height: 508, bottomInset: 336 });

            // A later, unrelated change with no event and no more pending
            // timers must NOT be picked up — the safety net is bounded, not a
            // permanent poll.
            act(() => {
                viewport.height = LAYOUT_HEIGHT;
                vi.advanceTimersByTime(5000);
            });
            expect(result.current).toEqual({ height: 508, bottomInset: 336 });
        });
    });
});
