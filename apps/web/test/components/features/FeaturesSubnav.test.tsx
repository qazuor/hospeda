/**
 * @file FeaturesSubnav.test.tsx
 * @description Unit tests for the `FeaturesSubnav` scroll-spy island
 * (HOS-119 T-006). Mirrors the IntersectionObserver-mocking pattern used by
 * `AnimatedCounter.test.tsx`. The island renders no DOM of its own — it
 * mutates the static subnav `<a>` elements already present in the document,
 * so tests render a minimal static subnav + section scaffold alongside the
 * island, exactly like the real page does.
 *
 * Tasks: T-010
 */
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeaturesSubnav } from '../../../src/components/features/FeaturesSubnav.client';

const SECTION_IDS = ['viajeros', 'anfitriones', 'gastro'] as const;

/** Renders the static subnav links + section scaffold the real page provides. */
function renderStaticScaffold(): void {
    document.body.innerHTML = `
        <nav>
            ${SECTION_IDS.map((id) => `<a href="#${id}" data-subnav-link="${id}">${id}</a>`).join('')}
        </nav>
        ${SECTION_IDS.map((id) => `<section id="${id}"></section>`).join('')}
    `;
}

/**
 * Builds a fake IntersectionObserver class that reports ONLY the element
 * whose id is `targetId` as intersecting, ignoring every other observed
 * element — simulating a single section currently in the viewport.
 */
function buildSingleTargetIntersectingObserver(
    targetId: string
): typeof globalThis.IntersectionObserver {
    return class SingleTargetIntersectingObserver {
        private readonly callback: IntersectionObserverCallback;
        observe = vi.fn((target: Element) => {
            if (target.id !== targetId) {
                return;
            }
            queueMicrotask(() => {
                this.callback(
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
                    this as unknown as IntersectionObserver
                );
            });
        });
        unobserve = vi.fn();
        disconnect = vi.fn();
        takeRecords = (): IntersectionObserverEntry[] => [];

        constructor(callback: IntersectionObserverCallback) {
            this.callback = callback;
        }
    } as unknown as typeof globalThis.IntersectionObserver;
}

describe('FeaturesSubnav', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('renders no DOM of its own', () => {
        renderStaticScaffold();
        const { container } = render(<FeaturesSubnav sectionIds={SECTION_IDS} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('observes every section referenced by sectionIds', () => {
        renderStaticScaffold();
        const observeSpy = vi.fn();
        class TrackingObserver {
            observe = observeSpy;
            unobserve = vi.fn();
            disconnect = vi.fn();
            takeRecords = (): IntersectionObserverEntry[] => [];
        }
        const previous = globalThis.IntersectionObserver;
        (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
            TrackingObserver;

        try {
            render(<FeaturesSubnav sectionIds={SECTION_IDS} />);
            expect(observeSpy).toHaveBeenCalledTimes(SECTION_IDS.length);
        } finally {
            (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
                previous;
        }
    });

    it('sets data-active="true" on the subnav link matching the in-view section', async () => {
        renderStaticScaffold();
        const previous = globalThis.IntersectionObserver;
        globalThis.IntersectionObserver = buildSingleTargetIntersectingObserver('viajeros');

        try {
            render(<FeaturesSubnav sectionIds={SECTION_IDS} />);
            // Flush the queued microtask that fires the IO callback.
            await Promise.resolve();
            await Promise.resolve();

            const activeLink = document.querySelector('[data-subnav-link="viajeros"]');
            expect(activeLink?.getAttribute('data-active')).toBe('true');

            // Only one link should be marked active at a time.
            const otherLink = document.querySelector('[data-subnav-link="anfitriones"]');
            expect(otherLink?.hasAttribute('data-active')).toBe(false);
        } finally {
            globalThis.IntersectionObserver = previous;
        }
    });

    it('is a no-op with an empty sectionIds array (does not throw)', () => {
        renderStaticScaffold();
        expect(() => render(<FeaturesSubnav sectionIds={[]} />)).not.toThrow();
    });

    it('does not crash when no matching section elements exist in the DOM', () => {
        document.body.innerHTML = '<nav></nav>';
        expect(() => render(<FeaturesSubnav sectionIds={SECTION_IDS} />)).not.toThrow();
    });

    it('is SSR-safe: renderToString does not crash even without IntersectionObserver', () => {
        // Astro server-renders islands before hydration, in a Node.js context
        // where `document` and `IntersectionObserver` do not exist at all.
        // `react-dom/server`'s renderToString never runs `useEffect` (by
        // design — effects are a client/hydration-only concept), so the
        // component's only IntersectionObserver usage (inside its effect)
        // must never execute during this pass. Deleting the global here
        // makes that guarantee explicit rather than incidental.
        const previous = globalThis.IntersectionObserver;
        // @ts-expect-error — simulating a Node.js SSR environment.
        delete globalThis.IntersectionObserver;

        try {
            expect(() => renderToString(<FeaturesSubnav sectionIds={SECTION_IDS} />)).not.toThrow();
        } finally {
            globalThis.IntersectionObserver = previous;
        }
    });

    it('renders null (no output) via server-side renderToString', () => {
        const html = renderToString(<FeaturesSubnav sectionIds={SECTION_IDS} />);
        expect(html).toBe('');
    });

    it('disconnects the observer on unmount', () => {
        renderStaticScaffold();
        const disconnectSpy = vi.fn();
        class TrackingObserver {
            observe = vi.fn();
            unobserve = vi.fn();
            disconnect = disconnectSpy;
            takeRecords = (): IntersectionObserverEntry[] => [];
        }
        const previous = globalThis.IntersectionObserver;
        (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
            TrackingObserver;

        try {
            const { unmount } = render(<FeaturesSubnav sectionIds={SECTION_IDS} />);
            unmount();
            expect(disconnectSpy).toHaveBeenCalledTimes(1);
        } finally {
            (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
                previous;
        }
    });
});
