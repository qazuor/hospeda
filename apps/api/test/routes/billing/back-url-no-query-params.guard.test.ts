/**
 * HOS-937 R-1 — static/behavioral guard: no MercadoPago `back_url` carries a
 * query param of our own.
 *
 * ## The bug this prevents
 *
 * MercadoPago's preapproval redirect concatenates its own query param
 * (`preapproval_id`) onto the configured `back_url` with a bare `?`, never
 * `&` (measured — see `.specs/HOS-937-preapproval-propio-por-usuario/spec.md`
 * §10 R-1). If our `back_url` already carries a `?` of its own, MercadoPago's
 * append produces a second `?` and `preapproval_id` stops parsing on return.
 *
 * It does not fire today only because every `back_url` builder in
 * `checkout-return-urls.ts` happens to return a clean URL — an accident, not
 * something previously defended. This guard makes that invariant explicit and
 * load-bearing.
 *
 * ## Why `notification_url` is exempt, on purpose
 *
 * `buildNotificationUrl()` is NOT a `back_url` — it is the webhook
 * `notification_url`, and it MUST carry `?source_news=webhooks`
 * (`V2_SOURCE_NEWS_MARKER`, HOS-159): the webhook router drops any delivery
 * missing that marker as a legacy IPN duplicate. MercadoPago appends its own
 * webhook params to `notification_url` with `&`, not `?`, so this file's bug
 * class does not apply there. Mixing the two invariants into one assertion
 * would be wrong for both, so this guard treats them as two different
 * contracts and only enforces the `back_url` one here.
 *
 * ## Why the guard is anchored on the constructed URL, not on a function name
 *
 * A guard that greps this file's source for `buildPaymentMethodReturnUrl` (or
 * any other specific export name) stops meaning anything the moment that
 * function is renamed — the grep silently matches zero occurrences and the
 * guard passes on code it never actually looked at. Instead, this guard
 * imports the WHOLE module as a namespace and iterates every export
 * structurally:
 *
 * - Skip anything that is not a function (constants, types).
 * - Skip anything the notification marker itself identifies as the webhook
 *   URL builder (an ACTUAL VALUE check, not a name check).
 * - Skip anything whose arity is 0 or 1 that throws when called with a plain
 *   locale string — that is `resolveReturnUrlLocale(c: Context)`, which needs
 *   a Hono `Context`, not a locale, and is not a URL builder at all.
 * - Skip multi-arg builders (`buildAddonSuccessUrl` / `buildAddonCancelUrl`,
 *   arity 2): those intentionally carry `?status=...&addon=...` because they
 *   are Checkout Pro redirect targets, a different MercadoPago flow that is
 *   NOT subject to the preapproval `back_url` concatenation bug (see their
 *   own regression tests in `checkout-return-urls.test.ts`, HOS-224).
 * - Every remaining function is a locale-only `back_url` builder targeting
 *   `HOSPEDA_SITE_URL`. Call it, and assert the result carries no `?`.
 *
 * A newly added `back_url` builder (renamed or not) is picked up automatically
 * by this iteration — nothing here has to be told it exists.
 *
 * @module test/routes/billing/back-url-no-query-params.guard
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/env.js', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://site.test',
        HOSPEDA_API_URL: 'https://api.test'
    }
}));

import * as returnUrlsModule from '../../../src/routes/billing/checkout-return-urls.js';

/** The marker unique to the webhook `notification_url` — the exemption anchor (a VALUE, not a name). */
const NOTIFICATION_MARKER = 'source_news=webhooks';

/** Locale probe used to invoke every candidate builder generically. */
const PROBE_LOCALE = 'es';

/**
 * Calls a candidate export with a plain locale string and reports whether it
 * behaves like a zero/one-arg `back_url` builder.
 *
 * @param fn - The exported value being probed.
 * @returns The built URL, or `null` if `fn` is not callable this way (wrong
 *   arity, or it threw — e.g. `resolveReturnUrlLocale` expects a Hono
 *   `Context`, not a string, and throws when given one).
 */
function tryBuildUrl(fn: unknown): string | null {
    if (typeof fn !== 'function') {
        return null;
    }
    if (fn.length > 1) {
        // Multi-arg builders (the add-on pair) are out of scope by construction.
        return null;
    }
    try {
        const result =
            fn.length === 0
                ? (fn as () => unknown)()
                : (fn as (l: string) => unknown)(PROBE_LOCALE);
        return typeof result === 'string' && result.startsWith('http') ? result : null;
    } catch {
        // Not a locale-only builder (e.g. resolveReturnUrlLocale needs a Context).
        return null;
    }
}

describe('HOS-937 R-1 guard — back_url builders carry no query params of our own', () => {
    const candidateEntries = Object.entries(returnUrlsModule)
        .map(([name, value]) => [name, tryBuildUrl(value)] as const)
        .filter((entry): entry is [string, string] => entry[1] !== null);

    it('discovers a non-empty set of locale-only URL builders (anti-vacuity)', () => {
        // Without this, a refactor that changes every builder's signature
        // (e.g. all take a full options object instead of a bare locale)
        // would leave this guard scanning ZERO functions and reporting green.
        expect(candidateEntries.length).toBeGreaterThanOrEqual(3);
    });

    it('exercises both the notification builder and at least one back_url builder', () => {
        // Confirms the exemption path and the guarded path are BOTH reachable
        // in this run, so a change that accidentally removed the notification
        // marker check (making everything look like a back_url) would show up
        // as a wrong count here rather than a silently-passing guard.
        const notificationCount = candidateEntries.filter(([, url]) =>
            url.includes(NOTIFICATION_MARKER)
        ).length;
        const backUrlCount = candidateEntries.length - notificationCount;

        expect(notificationCount).toBeGreaterThanOrEqual(1);
        expect(backUrlCount).toBeGreaterThanOrEqual(2);
    });

    it('every back_url builder returns a URL with no query string', () => {
        const offenders = candidateEntries
            .filter(([, url]) => !url.includes(NOTIFICATION_MARKER))
            .filter(([, url]) => url.includes('?'));

        expect(
            offenders.map(([name, url]) => `${name} -> ${url}`),
            'These builders returned a URL carrying a `?` of our own. MercadoPago ' +
                'concatenates its own `preapproval_id` query param onto the configured ' +
                '`back_url` with a bare `?`, not `&`, so any query string we add here stops ' +
                'the returning redirect from parsing (HOS-937 R-1). If this builder is meant ' +
                'to be a Checkout Pro redirect target (like the add-on pair) rather than a ' +
                'preapproval back_url, give it a second parameter so this guard stops treating ' +
                'it as a candidate, and add a regression test for it explicitly instead.'
        ).toEqual([]);
    });

    it('the notification builder still carries its required marker (exemption sanity check)', () => {
        // Guards the exemption itself: if buildNotificationUrl ever lost the
        // marker, it would silently fall into the "no query params allowed"
        // bucket above and this guard would start failing it for the wrong
        // reason instead of the webhook-router regression it actually is.
        expect(returnUrlsModule.buildNotificationUrl()).toContain(NOTIFICATION_MARKER);
    });
});
