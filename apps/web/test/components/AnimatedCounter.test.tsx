/**
 * @file AnimatedCounter.test.tsx
 * @description Unit tests for the AnimatedCounter React island.
 *
 * Coverage targets:
 * - Idle pre-intersection state (T-084 / S-11a): the counter renders "0"
 *   while the IntersectionObserver has not reported visibility, and does not
 *   start animating until the callback fires.
 *
 * Tasks: T-084 (S-11a)
 */

import { render, screen } from '@testing-library/react';
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
vi.mock('../../src/lib/icon-map', () => ({
    resolveWebIcon: () => undefined
}));

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AnimatedCounter — idle state (pre-intersection)', () => {
    beforeEach(() => {
        // The default IntersectionObserver shim from test/setup.ts is a no-op
        // (observe() never invokes the callback). That is exactly the idle
        // behavior we want here, so no extra wiring is required.
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders "0" before the IntersectionObserver fires', () => {
        render(
            <AnimatedCounter
                value={1234}
                label="alojamientos"
                locale="es"
            />
        );

        // The aria-hidden number node holds the formatted display value.
        // Before intersection, displayValue stays at 0 → formatted as "0".
        const numberNode = document.querySelector('[aria-hidden="true"]');
        expect(numberNode?.textContent).toBe('0');
    });

    it('does not start animating until the IntersectionObserver callback fires', () => {
        // Replace the global IntersectionObserver with a tracker that records
        // observe() calls but never invokes the visibility callback. This
        // simulates "element mounted but not yet in viewport".
        const observeSpy = vi.fn();
        const disconnectSpy = vi.fn();

        class TrackingIO {
            // biome-ignore lint/suspicious/noExplicitAny: jsdom-only test shim
            constructor(private cb: any) {}
            observe = observeSpy;
            unobserve = vi.fn();
            disconnect = disconnectSpy;
            takeRecords = () => [];
        }
        const previous = globalThis.IntersectionObserver;
        // biome-ignore lint/suspicious/noExplicitAny: jsdom-only test shim
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
            // … but no display update because the IO callback was never
            // invoked. The counter stays at "0" (formatted via Intl).
            expect(screen.getByLabelText('9.999 reseñas')).toBeInTheDocument();
            const numberNode = document.querySelector('[aria-hidden="true"]');
            expect(numberNode?.textContent).toBe('0');
        } finally {
            // biome-ignore lint/suspicious/noExplicitAny: restore shim
            (globalThis as any).IntersectionObserver = previous;
        }
    });
});
