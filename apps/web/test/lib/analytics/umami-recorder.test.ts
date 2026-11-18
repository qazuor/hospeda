/**
 * @file umami-recorder.test.ts
 * @description The client-side session recorder loader (HOS-2347 §6.4):
 * conditions, fail-closed paths, consent, idempotency and the soft-nav guard
 * (AC-W1..W9, W12, W13, R3, R5, R6).
 *
 * The router lifecycle is simulated with the real event names
 * (`astro:page-load`, `astro:before-preparation` carrying a `to` URL). Consent,
 * the api base URL and the identity gate are stubbed; the tracker wait is the
 * real one, driven by a `window.umami` stub.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getConsentMock, shouldHoldMock, waitForIdentityMock } = vi.hoisted(() => ({
    getConsentMock: vi.fn(),
    shouldHoldMock: vi.fn(),
    waitForIdentityMock: vi.fn()
}));

vi.mock('@/lib/cookie-consent', () => ({
    CONSENT_CHANGED_EVENT: 'cookie-consent:changed',
    getConsent: getConsentMock
}));
vi.mock('@/lib/env', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/env')>()),
    getApiUrl: () => 'https://api.test'
}));
vi.mock('@/lib/analytics/umami-identity-gate', () => ({
    shouldHoldForVisitorIdentity: shouldHoldMock,
    waitForVisitorIdentity: waitForIdentityMock
}));

import {
    RECORDER_SCRIPT_ID,
    type StartUmamiRecorderResult,
    startUmamiRecorder
} from '@/lib/analytics/umami-recorder';

const UMAMI_ORIGIN = 'https://umami.test';
const WEBSITE_ID = '208ccf14-c65d-4233-9612-c76b4fe9b47a';
const SWITCH_URL = 'https://api.test/api/v1/public/session-recording';

let handle: StartUmamiRecorderResult | null = null;

function renderTracker(): void {
    document.head.insertAdjacentHTML(
        'beforeend',
        `<script src="${UMAMI_ORIGIN}/hospeda.js" data-website-id="${WEBSITE_ID}" data-auto-pageview="false"></script>`
    );
    document.head.insertAdjacentHTML(
        'beforeend',
        '<meta name="astro-view-transitions-enabled" content="true">'
    );
}

function installTracker(): void {
    Reflect.set(window, 'umami', { track: vi.fn(), identify: vi.fn() });
}

function consent(analytics: boolean | null): void {
    getConsentMock.mockReturnValue(
        analytics === null
            ? null
            : { essential: true, analytics, marketing: false, version: 2, timestamp: 1 }
    );
}

function switchResponse(enabled: boolean): Response {
    return new Response(JSON.stringify({ success: true, data: { enabled } }), { status: 200 });
}

function recorderScripts(): HTMLScriptElement[] {
    return [...document.querySelectorAll<HTMLScriptElement>(`script#${RECORDER_SCRIPT_ID}`)];
}

function pageLoad(): void {
    document.dispatchEvent(new Event('astro:page-load'));
}

/** Lets pending promise continuations (fetch, json, waits) run. */
async function flush(): Promise<void> {
    for (let i = 0; i < 10; i++) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function setPath(pathname: string): void {
    window.history.replaceState(null, '', pathname);
}

function start(fetchImpl: typeof fetch, navigate = vi.fn()): ReturnType<typeof vi.fn> {
    handle = startUmamiRecorder({ fetchImpl, navigate, timeoutMs: 50 });
    return navigate;
}

beforeEach(() => {
    getConsentMock.mockReset();
    shouldHoldMock.mockReset().mockReturnValue(false);
    waitForIdentityMock.mockReset();
    setPath('/es/alojamientos/');
    renderTracker();
    installTracker();
});

afterEach(() => {
    handle?.stop();
    handle = null;
    document.head.innerHTML = '';
    Reflect.deleteProperty(window, 'umami');
    vi.useRealTimers();
});

describe('umami-recorder conditions (HOS-2347)', () => {
    it('AC-W1: injects exactly one recorder when every condition holds', async () => {
        // Arrange
        consent(true);
        const fetchImpl = vi.fn(async () => switchResponse(true));
        start(fetchImpl as unknown as typeof fetch);

        // Act
        pageLoad();
        await flush();

        // Assert
        const scripts = recorderScripts();
        expect(scripts).toHaveLength(1);
        expect(scripts[0]?.src).toBe(`${UMAMI_ORIGIN}/recorder.js`);
        expect(scripts[0]?.getAttribute('data-website-id')).toBe(WEBSITE_ID);
        expect(fetchImpl).toHaveBeenCalledWith(SWITCH_URL, expect.anything());
    });

    it.each([
        ['AC-W2', null],
        ['AC-W3', false]
    ] as const)('%s: consent %s injects nothing and never fetches', async (_ac, value) => {
        consent(value);
        const fetchImpl = vi.fn(async () => switchResponse(true));
        start(fetchImpl as unknown as typeof fetch);

        pageLoad();
        await flush();

        expect(recorderScripts()).toHaveLength(0);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('AC-W4: a later grant injects the recorder once', async () => {
        // Arrange
        consent(null);
        const fetchImpl = vi.fn(async () => switchResponse(true));
        start(fetchImpl as unknown as typeof fetch);
        pageLoad();
        await flush();

        // Act
        consent(true);
        window.dispatchEvent(
            new CustomEvent('cookie-consent:changed', { detail: { analytics: true } })
        );
        window.dispatchEvent(
            new CustomEvent('cookie-consent:changed', { detail: { analytics: true } })
        );
        await flush();

        // Assert
        expect(recorderScripts()).toHaveLength(1);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('AC-W5: { enabled: false } injects nothing', async () => {
        consent(true);
        start((async () => switchResponse(false)) as unknown as typeof fetch);

        pageLoad();
        await flush();

        expect(recorderScripts()).toHaveLength(0);
    });

    it.each([
        ['a network error', async () => Promise.reject(new TypeError('Failed to fetch'))],
        ['a 500', async () => new Response('{}', { status: 500 })],
        ['a 429', async () => new Response('{}', { status: 429 })],
        ['{}', async () => new Response('{}', { status: 200 })],
        [
            '{ enabled: "true" }',
            async () =>
                new Response(JSON.stringify({ success: true, data: { enabled: 'true' } }), {
                    status: 200
                })
        ],
        [
            'a bare { enabled: true } (no envelope)',
            async () => new Response(JSON.stringify({ enabled: true }), { status: 200 })
        ],
        ['non-JSON', async () => new Response('<html>', { status: 200 })]
    ])('AC-W6: fails closed on %s, with no error-level console output', async (_label, impl) => {
        // Arrange
        consent(true);
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        start(impl as unknown as typeof fetch);

        // Act
        pageLoad();
        await flush();

        // Assert
        expect(recorderScripts()).toHaveLength(0);
        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('AC-W6: fails closed when the switch request exceeds the timeout', async () => {
        consent(true);
        const hanging = ((_url: string, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () =>
                    reject(new DOMException('aborted', 'AbortError'))
                );
            })) as unknown as typeof fetch;
        start(hanging);

        pageLoad();
        await new Promise((resolve) => setTimeout(resolve, 120));
        await flush();

        expect(recorderScripts()).toHaveLength(0);
    });

    it('AC-W6: fails closed on a non-200 even when its body says enabled', async () => {
        consent(true);
        start(
            (async () =>
                new Response(JSON.stringify({ success: true, data: { enabled: true } }), {
                    status: 503
                })) as unknown as typeof fetch
        );

        pageLoad();
        await flush();

        expect(recorderScripts()).toHaveLength(0);
    });

    it('AC-W9: stays single when the router drops the element from <head> on a swap', async () => {
        consent(true);
        const fetchImpl = vi.fn(async () => switchResponse(true));
        start(fetchImpl as unknown as typeof fetch);
        pageLoad();
        await flush();

        document.getElementById(RECORDER_SCRIPT_ID)?.remove();
        pageLoad();
        await flush();

        expect(recorderScripts()).toHaveLength(0);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('AC-W7: without the tracker element nothing is injected and nothing fetched', async () => {
        document.head.innerHTML = '<meta name="astro-view-transitions-enabled" content="true">';
        consent(true);
        const fetchImpl = vi.fn(async () => switchResponse(true));
        start(fetchImpl as unknown as typeof fetch);

        pageLoad();
        await flush();

        expect(recorderScripts()).toHaveLength(0);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('AC-W8: holds the injection until the visitor identity settles', async () => {
        // Arrange
        consent(true);
        shouldHoldMock.mockReturnValue(true);
        let settle: (() => void) | undefined;
        waitForIdentityMock.mockImplementation(({ onSettled }: { onSettled: () => void }) => {
            settle = onSettled;
            return { cancel: () => undefined };
        });
        start((async () => switchResponse(true)) as unknown as typeof fetch);

        // Act
        pageLoad();
        await flush();

        // Assert: not before the identity settles...
        expect(waitForIdentityMock).toHaveBeenCalledTimes(1);
        expect(recorderScripts()).toHaveLength(0);

        // ...and right after it does.
        settle?.();
        await flush();
        expect(recorderScripts()).toHaveLength(1);
    });

    it('AC-W9: three more page loads keep exactly one recorder', async () => {
        consent(true);
        const fetchImpl = vi.fn(async () => switchResponse(true));
        start(fetchImpl as unknown as typeof fetch);
        pageLoad();
        await flush();

        pageLoad();
        pageLoad();
        pageLoad();
        await flush();

        expect(recorderScripts()).toHaveLength(1);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('AC-R3: an excluded current path injects nothing and never fetches', async () => {
        setPath('/es/auth/signin/');
        consent(true);
        const fetchImpl = vi.fn(async () => switchResponse(true));
        start(fetchImpl as unknown as typeof fetch);

        pageLoad();
        await flush();

        expect(recorderScripts()).toHaveLength(0);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('never injects when the tracker never loads (blocked by an ad blocker)', async () => {
        vi.useFakeTimers();
        Reflect.deleteProperty(window, 'umami');
        consent(true);
        start((async () => switchResponse(true)) as unknown as typeof fetch);

        pageLoad();
        await vi.advanceTimersByTimeAsync(10_000);

        expect(recorderScripts()).toHaveLength(0);
    });
});

describe('umami-recorder after it loaded (HOS-2347)', () => {
    async function loadRecorder(fetchImpl: typeof fetch): Promise<ReturnType<typeof vi.fn>> {
        consent(true);
        const navigate = start(fetchImpl);
        pageLoad();
        await flush();
        expect(recorderScripts()).toHaveLength(1);
        return navigate;
    }

    function prepareNavigation(href: string): Event {
        const event = new Event('astro:before-preparation', { cancelable: true });
        Reflect.set(event, 'to', new URL(href, window.location.origin));
        document.dispatchEvent(event);
        return event;
    }

    it('AC-R5: a soft navigation to an excluded path becomes a full page load', async () => {
        // Arrange
        const navigate = await loadRecorder((async () =>
            switchResponse(true)) as unknown as typeof fetch);

        // Act
        const event = prepareNavigation('/es/auth/signin/');

        // Assert
        expect(event.defaultPrevented).toBe(true);
        expect(navigate).toHaveBeenCalledWith(`${window.location.origin}/es/auth/signin/`);
    });

    it('AC-R5: a soft navigation to an allowed path stays soft', async () => {
        const navigate = await loadRecorder((async () =>
            switchResponse(true)) as unknown as typeof fetch);

        const event = prepareNavigation('/es/destinos/');

        expect(event.defaultPrevented).toBe(false);
        expect(navigate).not.toHaveBeenCalled();
    });

    it('AC-R5: before the recorder loads, the soft-nav guard does nothing', () => {
        consent(false);
        const navigate = start((async () => switchResponse(true)) as unknown as typeof fetch);

        const event = prepareNavigation('/es/auth/signin/');

        expect(event.defaultPrevented).toBe(false);
        expect(navigate).not.toHaveBeenCalled();
    });

    it('AC-R6: an excluded landing page, then a soft nav to an allowed page, records there', async () => {
        // Arrange
        setPath('/es/contacto/');
        consent(true);
        const fetchImpl = vi.fn(async () => switchResponse(true));
        start(fetchImpl as unknown as typeof fetch);
        pageLoad();
        await flush();
        expect(recorderScripts()).toHaveLength(0);

        // Act
        setPath('/es/alojamientos/');
        pageLoad();
        await flush();

        // Assert
        expect(recorderScripts()).toHaveLength(1);
    });

    it('AC-W12: a revoke neither reloads nor navigates at revoke time', async () => {
        // Arrange
        const reloadSpy = vi.fn();
        const assignSpy = vi.fn();
        const location = window.location;
        vi.spyOn(window, 'location', 'get').mockReturnValue({
            ...location,
            pathname: location.pathname,
            href: location.href,
            origin: location.origin,
            reload: reloadSpy,
            assign: assignSpy
        } as unknown as Location);
        const navigate = await loadRecorder((async () =>
            switchResponse(true)) as unknown as typeof fetch);

        // Act
        consent(false);
        window.dispatchEvent(
            new CustomEvent('cookie-consent:changed', { detail: { analytics: false } })
        );
        await flush();

        // Assert
        expect(reloadSpy).not.toHaveBeenCalled();
        expect(assignSpy).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });

    it('AC-W12 (review fix): after a revoke, the next soft navigation becomes a full page load', async () => {
        // Arrange
        const navigate = await loadRecorder((async () =>
            switchResponse(true)) as unknown as typeof fetch);
        consent(false);
        window.dispatchEvent(
            new CustomEvent('cookie-consent:changed', { detail: { analytics: false } })
        );
        await flush();

        // Act: a soft navigation to an ALLOWED page.
        const event = prepareNavigation('/es/destinos/');

        // Assert: the swap is cancelled and a full navigation forced, so the
        // recorder cannot follow the visitor into the next page.
        expect(event.defaultPrevented).toBe(true);
        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith(`${window.location.origin}/es/destinos/`);
    });

    it('AC-W12: the full page load forced after a revoke records nothing and fetches nothing', async () => {
        // Arrange: a fresh document with a revoked consent (what the forced
        // full navigation above lands on).
        consent(false);
        const nextFetch = vi.fn(async () => switchResponse(true));
        start(nextFetch as unknown as typeof fetch);

        // Act
        pageLoad();
        await flush();

        // Assert
        expect(recorderScripts()).toHaveLength(0);
        expect(nextFetch).not.toHaveBeenCalled();
    });

    it('AC-W13: switch-off does not reload the open document; the next load records nothing', async () => {
        // Arrange
        const navigate = await loadRecorder((async () =>
            switchResponse(true)) as unknown as typeof fetch);

        // Act: the switch flips off; more soft loads in this document.
        pageLoad();
        await flush();

        // Assert: no navigation in this document.
        expect(navigate).not.toHaveBeenCalled();

        // Next full page load with the endpoint now answering { enabled: false }.
        handle?.stop();
        document.getElementById(RECORDER_SCRIPT_ID)?.remove();
        start((async () => switchResponse(false)) as unknown as typeof fetch);
        pageLoad();
        await flush();
        expect(recorderScripts()).toHaveLength(0);
    });
});

describe('umami-recorder navigation race (HOS-2347 security review)', () => {
    /** A switch fetch whose answer the test releases by hand. */
    function deferredSwitch(): { fetchImpl: typeof fetch; release: (enabled: boolean) => void } {
        let resolve: ((response: Response) => void) | undefined;
        const fetchImpl = (() =>
            new Promise<Response>((r) => {
                resolve = r;
            })) as unknown as typeof fetch;
        return { fetchImpl, release: (enabled) => resolve?.(switchResponse(enabled)) };
    }

    function prepareNavigation(href: string): Event {
        const event = new Event('astro:before-preparation', { cancelable: true });
        Reflect.set(event, 'to', new URL(href, window.location.origin));
        document.dispatchEvent(event);
        return event;
    }

    function completeSwap(pathname: string): void {
        setPath(pathname);
        document.dispatchEvent(new Event('astro:after-swap'));
        pageLoad();
    }

    it('never injects when a navigation into an excluded route starts during evaluation', async () => {
        // Arrange
        consent(true);
        const { fetchImpl, release } = deferredSwitch();
        start(fetchImpl);
        pageLoad();
        await flush();

        // Act: the visitor clicks into /auth while the switch request is in flight.
        prepareNavigation('/es/auth/signin/');
        release(true);
        await flush();

        // Assert: nothing before the swap, and nothing after landing on /auth.
        expect(recorderScripts()).toHaveLength(0);
        completeSwap('/es/auth/signin/');
        await flush();
        expect(recorderScripts()).toHaveLength(0);
    });

    it('treats any navigation started during evaluation as a cancel, then records after page-load on an allowed page', async () => {
        // Arrange
        consent(true);
        const { fetchImpl, release } = deferredSwitch();
        const second = vi.fn(async () => switchResponse(true));
        let calls = 0;
        const routed = ((...args: Parameters<typeof fetch>) => {
            calls += 1;
            return calls === 1 ? fetchImpl(...args) : second(...args);
        }) as typeof fetch;
        start(routed);
        pageLoad();
        await flush();

        // Act: a soft nav to an allowed page starts mid-evaluation.
        prepareNavigation('/es/destinos/');
        release(true);
        await flush();

        // Assert: cancelled while the navigation is pending...
        expect(recorderScripts()).toHaveLength(0);

        // ...and injected once the new page has loaded.
        completeSwap('/es/destinos/');
        await flush();
        expect(recorderScripts()).toHaveLength(1);
    });
});
