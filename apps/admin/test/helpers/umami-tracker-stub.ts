/**
 * @file umami-tracker-stub.ts
 * @description A `window.umami` stub that behaves like the Umami 3.5.0 tracker
 * where the admin identify order depends on it (HOS-2119, OQ-5). Mirrors
 * `apps/web/test/helpers/umami-tracker-stub.ts`, simplified:
 *
 * - `track()` returns a promise that settles only when the test answers the
 *   request (`respond`), like the tracker's `send()` awaiting `fetch`. Answering
 *   ANY request (pageview or custom event) stores the token, as the tracker
 *   does. `answerPageview` stores it without a `track` call (a request the
 *   test does not model, e.g. the old auto pageview).
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
    /** Stores the cache token as if some request had been answered. */
    readonly answerPageview: (input?: AnswerPageviewInput) => void;
    /** Answers the oldest pending `track` request (stores the token when ok). */
    readonly respond: (input?: AnswerPageviewInput) => void;
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
    const pending: Array<(ok: boolean) => void> = [];

    const track = vi.fn(
        () =>
            new Promise<void>((resolve) => {
                pending.push((ok) => {
                    if (ok) cache = STUB_CACHE_TOKEN;
                    resolve();
                });
            })
    );
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
        respond: ({ ok = true }: AnswerPageviewInput = {}) => pending.shift()?.(ok),
        identifyCaches
    };
}
