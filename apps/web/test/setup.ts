/**
 * @file setup.ts
 * @description Global test setup for Vitest + @testing-library/react.
 * Extends expect with jest-dom matchers (toBeInTheDocument, etc.) and
 * polyfills browser APIs missing from jsdom that island components rely on
 * (e.g. IntersectionObserver used by AnimatedCounter and lazy-loaded UI).
 */

import '@testing-library/jest-dom/vitest';

// jsdom does not implement IntersectionObserver; provide a minimal mock so
// islands like AnimatedCounter can mount inside vitest without throwing.
if (typeof globalThis.IntersectionObserver === 'undefined') {
    class MockIntersectionObserver {
        readonly root: Element | null = null;
        readonly rootMargin: string = '';
        readonly thresholds: ReadonlyArray<number> = [];
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
        takeRecords(): IntersectionObserverEntry[] {
            return [];
        }
    }
    (
        globalThis as unknown as { IntersectionObserver: typeof MockIntersectionObserver }
    ).IntersectionObserver = MockIntersectionObserver;
}

// jsdom also lacks `window.matchMedia`. Several islands consult it for
// responsive behaviour (TestimonialsCarousel reads `prefers-reduced-motion`,
// SearchBar uses media queries for the destinations panel, etc.). Tests fail
// with `window.matchMedia is not a function` without this shim. The mock
// always reports "no match"; tests that need a specific media-query result
// override it locally with `vi.spyOn(window, 'matchMedia')`.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false
        })
    });
}

// recharts ResponsiveContainer uses ResizeObserver which jsdom does not provide.
if (typeof globalThis.ResizeObserver === 'undefined') {
    class MockResizeObserver {
        readonly root: Element | null = null;
        readonly rootMargin: string = '';
        readonly thresholds: ReadonlyArray<number> = [];
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
        takeRecords(): ResizeObserverEntry[] {
            return [];
        }
    }
    (globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
        MockResizeObserver;
}

// Prosemirror-view (used by TipTap) calls getClientRects() on DOM elements
// during selection rendering. jsdom does not implement this method.
if (typeof Element !== 'undefined' && !Element.prototype.getClientRects) {
    Element.prototype.getClientRects = () => [] as DOMRectList;
}
if (typeof Range !== 'undefined' && !Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => [] as DOMRectList;
}
