/**
 * @file setup.ts
 * @description Global test setup for Vitest + @testing-library/react.
 * Extends expect with jest-dom matchers (toBeInTheDocument, etc.) and
 * polyfills browser APIs missing from jsdom that island components rely on
 * (e.g. IntersectionObserver used by AnimatedCounter and lazy-loaded UI).
 */

import '@testing-library/jest-dom/vitest';
import { trans } from '@repo/i18n/web';
import { afterEach } from 'vitest';
import { resetInFlightAuthMe } from '../src/lib/auth-cache';

// HOS-160 lever D: `fetchAuthMe` shares a module-level in-flight promise to dedup
// concurrent callers. A test that renders an island with a pending `/auth/me`
// fetch leaves that promise set; without this reset, following tests reuse the
// stale promise and never call `fetch`. Clear it after every test.
afterEach(resetInFlightAuthMe);

// HOS-160 lever A / HOS-369 Wave D: client islands read their translations from
// `window.__HOSPEDA_I18N__` via `@/lib/i18n` instead of importing the full
// catalog. In production that global is assigned by the hashed, immutable
// `/i18n/<locale>.<hash>.js` script the page links from <head>. Vitest runs in
// client mode (`import.meta.env.SSR === false`), so `createTranslations` follows
// that same path; without the global every key would resolve to `[MISSING: …]`.
//
// The global is keyed BY LOCALE, so seeding the whole `trans` catalog serves
// whichever locale a test renders (production ships exactly one locale per page;
// tests exercise es/en/pt) — the multi-locale convenience the previous
// `{ all: trans }` data element gave, now the production shape itself.
//
// Nothing is appended to the DOM: a global cannot be matched by component tests
// that assert on `body`/container text, which the old ~630 KB inline JSON blob
// could (hence its deliberate placement in <head> back then).
if (typeof window !== 'undefined' && !window.__HOSPEDA_I18N__) {
    window.__HOSPEDA_I18N__ = trans;
}

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

// Leaflet and Prosemirror call elementFromPoint() and getBoundingClientRect()
// on DOM elements. jsdom does not implement these methods properly.
if (typeof document !== 'undefined') {
    if (!document.elementFromPoint) {
        document.elementFromPoint = () => document.createElement('div');
    }
}
// Mock getBoundingClientRect on Element.prototype — prosemirror-view calls it
// on arbitrary DOM targets during selection rendering and scroll-to-selection.
if (typeof Element !== 'undefined') {
    Element.prototype.getBoundingClientRect = () =>
        ({
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => ({})
        }) as DOMRect;
}
