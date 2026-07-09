/**
 * @file AnimatedCounter.test.tsx
 * @description Unit tests for the AnimatedCounter React island.
 *
 * Coverage targets:
 * - SSR-first pre-intersection state (HOS-117 T-004, regresses the "0+" bug):
 *   the counter renders the REAL formatted value (never "0") while the
 *   IntersectionObserver has not reported visibility, so crawlers / LLM fetchers
 *   that don't run JS or scroll see the true number in the SSR HTML.
 * - Locale formatting after intersection (T-085 / S-11b): once the observer
 *   reports visibility, the counter animates (0 → value) and ends on the localized
 *   formatted value (es-AR / en-US).
 *
 * Tasks: T-084 (S-11a), T-085 (S-11b), HOS-117 T-004
 */

import { toBcp47Locale } from '@repo/i18n';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimatedCounter } from '../../src/components/sections/AnimatedCounter.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Stable string-key proxy for CSS modules so className lookups don't crash.
vi.mock('../../src/components/sections/AnimatedCounter.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// Reduced motion hook: default to false so the RAF path is exercised when the
// observer fires. Tests that need a different value can override per-case.
vi.mock('../../src/hooks/use-reduced-motion', () => ({
    useReducedMotion: () => false
}));

// Icon resolver: AnimatedCounter only invokes this when an `icon` prop is
// passed; returning undefined keeps the test surface free of icon rendering.
vi.mock('../../src/lib/stats-icons', () => ({
    resolveStatsIcon: () => undefined
}));

// ─── Suite: SSR-first pre-intersection (HOS-117 T-004) ────────────────────────

describe('AnimatedCounter — SSR-first: real value before intersection', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders the real formatted value (not "0") before the IntersectionObserver fires', () => {
        // Regression for the "0+" bug (HOS-117 T-004): the initial render — which
        // is exactly what SSR emits and what a no-JS crawler receives — must show
        // the real number, never 0.
        render(
            <AnimatedCounter
                value={1234}
                label="alojamientos"
                locale="es"
            />
        );

        const expected = new Intl.NumberFormat(toBcp47Locale('es')).format(1234);
        const numberNode = document.querySelector('[aria-hidden="true"]');
        expect(numberNode?.textContent).toBe(expected);
        expect(numberNode?.textContent).not.toBe('0');
    });

    it('keeps the real value when mounted but not yet scrolled into view', () => {
        // Replace the global IntersectionObserver with a tracker that records
        // observe() calls but never invokes the visibility callback. This
        // simulates "element mounted but not yet in viewport".
        const observeSpy = vi.fn();

        class TrackingIO {
            observe = observeSpy;
            unobserve = vi.fn();
            disconnect = vi.fn();
            takeRecords = () => [] as IntersectionObserverEntry[];
        }
        const previous = globalThis.IntersectionObserver;
        (globalThis as any).IntersectionObserver = TrackingIO;

        try {
            render(
                <AnimatedCounter
                    value={9999}
                    label="reseñas"
                    locale="es"
                />
            );

            // observer.observe(element) was called …
            expect(observeSpy).toHaveBeenCalledTimes(1);
            // … and with no visibility callback the animation never starts, so the
            // node keeps showing the real value (never drops to 0).
            expect(screen.getByLabelText('9.999 reseñas')).toBeInTheDocument();
            const numberNode = document.querySelector('[aria-hidden="true"]');
            expect(numberNode?.textContent).toBe('9.999');
        } finally {
            (globalThis as any).IntersectionObserver = previous;
        }
    });
});

// ─── Suite: locale formatting after intersection (T-085) ──────────────────────

/**
 * Install an IntersectionObserver shim that fires `isIntersecting: true`
 * via a microtask when `observe()` is called. Returns the previous value so
 * the caller can restore it.
 */
function installFiringObserver(): typeof globalThis.IntersectionObserver {
    const previous = globalThis.IntersectionObserver;
    class FiringIO {
        constructor(
            private cb: (entries: IntersectionObserverEntry[], observer: unknown) => void
        ) {}
        observe = (target: Element): void => {
            queueMicrotask(() => {
                this.cb(
                    [
                        {
                            isIntersecting: true,
                            target,
                            intersectionRatio: 1,
                            time: 0,
                            boundingClientRect: {} as DOMRectReadOnly,
                            intersectionRect: {} as DOMRectReadOnly,
                            rootBounds: null
                        }
                    ] as IntersectionObserverEntry[],
                    this
                );
            });
        };
        unobserve = (): void => {};
        disconnect = (): void => {};
        takeRecords = (): IntersectionObserverEntry[] => [];
    }
    (globalThis as any).IntersectionObserver = FiringIO;
    return previous;
}

interface VirtualClock {
    advance: (totalMs: number, stepMs?: number) => void;
    flushMicrotasks: () => Promise<void>;
}

/**
 * Install a deterministic RAF/perf.now virtual clock. Returns the cleanup
 * function and helpers to advance frames and flush microtasks.
 */
function installVirtualClock(): {
    cleanup: () => void;
    clock: VirtualClock;
} {
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    const originalPerfNow = globalThis.performance.now.bind(globalThis.performance);

    let virtualNow = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextHandle = 1;

    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback): number => {
        const handle = nextHandle++;
        callbacks.set(handle, cb);
        return handle;
    };
    (globalThis as any).cancelAnimationFrame = (handle: number): void => {
        callbacks.delete(handle);
    };
    (globalThis.performance as any).now = (): number => virtualNow;

    const clock: VirtualClock = {
        advance: (totalMs: number, stepMs = 16): void => {
            const end = virtualNow + totalMs;
            while (virtualNow < end) {
                virtualNow = Math.min(virtualNow + stepMs, end);
                const pending = Array.from(callbacks.entries());
                callbacks.clear();
                for (const [, cb] of pending) {
                    cb(virtualNow);
                }
            }
        },
        flushMicrotasks: async (): Promise<void> => {
            await Promise.resolve();
            await Promise.resolve();
        }
    };

    const cleanup = (): void => {
        (globalThis as any).requestAnimationFrame = originalRaf;
        (globalThis as any).cancelAnimationFrame = originalCancelRaf;
        (globalThis.performance as any).now = originalPerfNow;
    };

    return { cleanup, clock };
}

describe('AnimatedCounter — locale formatting after intersection', () => {
    let previousIO: typeof globalThis.IntersectionObserver;
    let cleanupClock: () => void;
    let clock: VirtualClock;

    beforeEach(() => {
        previousIO = installFiringObserver();
        const installed = installVirtualClock();
        cleanupClock = installed.cleanup;
        clock = installed.clock;
    });

    afterEach(() => {
        (globalThis as any).IntersectionObserver = previousIO;
        cleanupClock();
        vi.clearAllMocks();
    });

    it.each([
        {
            locale: 'es' as const,
            expected: new Intl.NumberFormat(toBcp47Locale('es')).format(1234)
        },
        {
            locale: 'en' as const,
            expected: new Intl.NumberFormat(toBcp47Locale('en')).format(1234)
        }
    ])('renders the value formatted for locale=$locale after the animation completes', async ({
        locale,
        expected
    }) => {
        render(
            <AnimatedCounter
                value={1234}
                label="alojamientos"
                locale={locale}
            />
        );

        // Flush the queued IO callback so the component schedules its
        // first RAF tick and exits the idle "0" state.
        await act(async () => {
            await clock.flushMicrotasks();
        });

        // Advance the virtual clock past the 2000ms default duration.
        // The component clamps `progress` to 1 and snaps to the exact
        // final value.
        await act(async () => {
            clock.advance(2200);
        });

        const numberNode = document.querySelector('[aria-hidden="true"]');
        expect(numberNode?.textContent).toBe(expected);

        // Sanity: aria-label uses the same formatted final value.
        expect(screen.getByLabelText(`${expected} alojamientos`)).toBeInTheDocument();
    });
});
