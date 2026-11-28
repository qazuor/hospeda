/**
 * @file InternalEntryTracker.test.tsx
 * @description Tests for the listing internal-entry island (HOS-2119 T-076).
 * Uses the real umami client against a `window.umami` stub, so the asserted
 * payload is exactly what the tracker would receive (function form of
 * `umami.track`, tag included).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InternalEntryTracker } from '@/components/analytics/InternalEntryTracker.client';
import {
    type StartUmamiPageviewsResult,
    startUmamiPageviews
} from '@/lib/analytics/umami-pageview';
import { saveConsent } from '@/lib/cookie-consent';

const ENTITY_ID = '3f2b8c1e-5d4a-4c7b-9e1f-0a1b2c3d4e5f';
const SAME_ORIGIN_REFERRER = `${window.location.origin}/es/alojamientos/`;

interface UmamiStub {
    track: ReturnType<typeof vi.fn>;
    identify: ReturnType<typeof vi.fn>;
}

function installUmami(): UmamiStub {
    const stub: UmamiStub = { track: vi.fn(), identify: vi.fn() };
    (window as unknown as { umami?: UmamiStub }).umami = stub;
    return stub;
}

function setReferrer(value: string): void {
    Object.defineProperty(document, 'referrer', { value, configurable: true });
}

function mountTracker(): void {
    render(
        <InternalEntryTracker
            entityType="ACCOMMODATION"
            entityId={ENTITY_ID}
            locale="es"
        />
    );
}

/** Resolves the function form of `umami.track` against a blank base payload. */
function payloadOf(stub: UmamiStub, call = 0): unknown {
    const arg = stub.track.mock.calls[call]?.[0] as (base: object) => unknown;
    return arg({});
}

beforeEach(() => {
    vi.useFakeTimers();
});

let pageviews: StartUmamiPageviewsResult | null = null;

/** Head of a ClientRouter page with the tracker, plus the pageview wiring. */
function startRouterPage(): void {
    document.head.insertAdjacentHTML(
        'beforeend',
        '<meta name="umami-config" data-script-url="https://umami.test/t.js" data-website-id="site-id"><meta name="astro-view-transitions-enabled" content="true">'
    );
    pageviews = startUmamiPageviews();
    document.dispatchEvent(new Event('astro:page-load'));
}

beforeEach(() => {
    saveConsent({ crashReporting: false, analytics: true, marketing: false });
});

afterEach(() => {
    document.cookie = 'cookie-consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    pageviews?.stop();
    pageviews = null;
    document.head.innerHTML = '';
    vi.useRealTimers();
    (window as unknown as { umami?: unknown }).umami = undefined;
    setReferrer('');
});

describe('InternalEntryTracker', () => {
    it('emits once with the exact payload on a same-origin referrer', () => {
        const umami = installUmami();
        setReferrer(SAME_ORIGIN_REFERRER);

        mountTracker();

        expect(umami.track).toHaveBeenCalledTimes(1);
        expect(payloadOf(umami)).toEqual({
            name: 'listing_internal_entry',
            data: {
                entity_id: ENTITY_ID,
                entity_type: 'ACCOMMODATION',
                locale: 'es',
                app: 'web',
                app_version: expect.any(String),
                environment: 'development'
            },
            tag: ENTITY_ID
        });
    });

    it('does not emit on an external referrer', () => {
        const umami = installUmami();
        setReferrer('https://www.google.com/search?q=hospeda');
        mountTracker();
        expect(umami.track).not.toHaveBeenCalled();
    });

    it('does not emit on an empty referrer', () => {
        const umami = installUmami();
        setReferrer('');
        mountTracker();
        expect(umami.track).not.toHaveBeenCalled();
    });

    it('does not emit on a lookalike origin', () => {
        const umami = installUmami();
        setReferrer(`${window.location.origin}.evil.com/page`);
        mountTracker();
        expect(umami.track).not.toHaveBeenCalled();
    });

    it('does not emit on an unparsable referrer', () => {
        const umami = installUmami();
        setReferrer('not a url');
        mountTracker();
        expect(umami.track).not.toHaveBeenCalled();
    });

    it('waits for a late window.umami and then emits once', () => {
        setReferrer(SAME_ORIGIN_REFERRER);
        mountTracker();

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        const umami = installUmami();
        expect(umami.track).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(umami.track).toHaveBeenCalledTimes(1);

        act(() => {
            vi.advanceTimersByTime(10_000);
        });
        expect(umami.track).toHaveBeenCalledTimes(1);
    });

    it('gives up silently when the tracker never loads', () => {
        setReferrer(SAME_ORIGIN_REFERRER);
        mountTracker();

        expect(() => {
            act(() => {
                vi.advanceTimersByTime(30_000);
            });
        }).not.toThrow();
        expect(vi.getTimerCount()).toBe(0);

        const umami = installUmami();
        act(() => {
            vi.advanceTimersByTime(30_000);
        });
        expect(umami.track).not.toHaveBeenCalled();
    });

    it('does not emit after unmount while waiting', () => {
        setReferrer(SAME_ORIGIN_REFERRER);
        const { unmount } = render(
            <InternalEntryTracker
                entityType="VENUE"
                entityId={ENTITY_ID}
                locale="es"
            />
        );
        unmount();
        const umami = installUmami();
        act(() => {
            vi.advanceTimersByTime(10_000);
        });
        expect(umami.track).not.toHaveBeenCalled();
    });
});

describe('InternalEntryTracker after a ClientRouter soft navigation', () => {
    it('emits when the visitor soft-navigated from another Hospeda page', () => {
        // The landing page came from Google; pushState never updates
        // document.referrer, so only the recorded soft-nav origin can tell.
        setReferrer('https://www.google.com/search?q=hospeda');
        window.history.replaceState({}, '', '/es/alojamientos/');
        const umami = installUmami();
        startRouterPage();
        // Drop the pageview of the landing page; only the entry event matters.
        umami.track.mockClear();

        document.dispatchEvent(new Event('astro:before-swap'));
        window.history.pushState({}, '', '/es/alojamientos/casa/');
        mountTracker();

        expect(umami.track).toHaveBeenCalledTimes(1);
        expect(payloadOf(umami)).toMatchObject({ name: 'listing_internal_entry', tag: ENTITY_ID });
    });

    it('does not emit on an external first load', () => {
        setReferrer('https://www.google.com/search?q=hospeda');
        window.history.replaceState({}, '', '/es/alojamientos/casa/');
        const umami = installUmami();
        startRouterPage();
        // Drop the pageview of the landing page; only the entry event matters.
        umami.track.mockClear();

        mountTracker();

        expect(umami.track).not.toHaveBeenCalled();
    });

    it('re-evaluates on each page load: a later mount counts its own entry', () => {
        setReferrer('');
        window.history.replaceState({}, '', '/es/');
        const umami = installUmami();
        startRouterPage();
        // Drop the pageview of the landing page; only the entry event matters.
        umami.track.mockClear();

        const first = render(
            <InternalEntryTracker
                entityType="ACCOMMODATION"
                entityId={ENTITY_ID}
                locale="es"
            />
        );
        expect(umami.track).not.toHaveBeenCalled();
        first.unmount();

        document.dispatchEvent(new Event('astro:before-swap'));
        window.history.pushState({}, '', '/es/alojamientos/casa/');
        mountTracker();

        expect(umami.track).toHaveBeenCalledTimes(1);
    });
});

describe('detail pages render the tracker', () => {
    const PAGES = {
        'alojamientos/[slug].astro': ['ACCOMMODATION', 'accommodation.id'],
        'comer-y-salir/[slug].astro': ['VENUE', 'venue.id'],
        'experiencias/[slug].astro': ['EXPERIENCE', 'experience.id'],
        'partners/[slug].astro': ['PARTNER', 'partnerId']
    } as const;

    it.each(Object.entries(PAGES))('%s mounts it with the entity id', (page, [type, idExpr]) => {
        const source = readFileSync(
            resolve(__dirname, '../../../src/pages/[lang]', page),
            'utf8'
        ).replace(/<!--[\s\S]*?-->/g, '');
        expect(source).toContain(
            "import { InternalEntryTracker } from '@/components/analytics/InternalEntryTracker.client';"
        );
        const tag = source.match(/<InternalEntryTracker\b[\s\S]*?\/>/)?.[0] ?? '';
        expect(tag).toContain('client:idle');
        expect(tag).toContain(`entityType="${type}"`);
        expect(tag).toContain(`entityId={${idExpr}}`);
        expect(tag).toContain('locale={locale}');
    });
});
