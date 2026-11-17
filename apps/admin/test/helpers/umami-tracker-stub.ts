/**
 * @file umami-tracker-stub.ts
 * @description A `window.umami` stub that behaves like the Umami 3.5.0 tracker
 * where the admin identify order depends on it (HOS-2119, OQ-5). Mirrors
 * `apps/web/test/helpers/umami-tracker-stub.ts`, simplified:
 *
 * - `track` resolves at once; the test decides when Umami answered a pageview
 *   with `answerPageview` (the admin sends pageviews itself through
 *   `trackPageview`, the tracker's auto pageview is off).
 * - Answering stores the `x-umami-cache` token, exposed through `getSession()`,
 *   as the tracker does with `data.cache`. A failed request
 *   (`answerPageview({ ok: false })`) leaves no token.
 * - `identify()` records whether the tracker held a token when it was called:
 *   an identify without it opens a separate `uuid(…, id)` session in Umami.
 */

import { vi } from 'vitest';

/** Input of {@link UmamiTrackerStub.answerPageview}. */
export interface AnswerPageviewInput {
    /** Whether the request reached Umami and returned a cache token. */
    readonly ok?: boolean;
}

/** Controllable stand-in for the Umami tracker. */
export interface UmamiTrackerStub {
    /** Spy of `umami.track`. */
    readonly track: ReturnType<typeof vi.fn>;
    /** Spy of `umami.identify`. */
    readonly identify: ReturnType<typeof vi.fn>;
    /** Answers a pageview: the tracker now holds the cache token. */
    readonly answerPageview: (input?: AnswerPageviewInput) => void;
    /** Cache token held when each `identify` call was made (`undefined` = none). */
    readonly identifyCaches: readonly (string | undefined)[];
}

/** Token value the stub stores when the pageview is answered. */
export const STUB_CACHE_TOKEN = 'cache-token';

/**
 * Installs the stub as `window.umami`.
 *
 * @param input - `withGetSession: false` models a tracker without `getSession`.
 * @returns The stub and its controls.
 */
export function installUmamiTrackerStub({
    withGetSession = true
}: {
    readonly withGetSession?: boolean;
} = {}): UmamiTrackerStub {
    let cache: string | undefined;
    const identifyCaches: Array<string | undefined> = [];

    const track = vi.fn(() => Promise.resolve());
    const identify = vi.fn(() => {
        identifyCaches.push(cache);
        return Promise.resolve();
    });
    const getSession = () => ({ cache, website: 'site-id' });

    const tracker = withGetSession ? { track, identify, getSession } : { track, identify };
    Reflect.set(window, 'umami', tracker);

    return {
        track,
        identify,
        answerPageview: ({ ok = true }: AnswerPageviewInput = {}) => {
            if (ok) cache = STUB_CACHE_TOKEN;
        },
        identifyCaches
    };
}
