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
    // biome-ignore lint/suspicious/noExplicitAny: minimal jsdom polyfill shim
    (globalThis as any).IntersectionObserver = MockIntersectionObserver;
}
