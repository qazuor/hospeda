/**
 * @file strip-checkout-return-params.snippet.ts
 * @description Inline-script source that scrubs sensitive provider query
 * parameters off the checkout return URL as early as possible on the client
 * (HOS-209, HOS-191 Path C defense-in-depth).
 *
 * ## Why this exists
 *
 * MercadoPago's share-link ("Path C") `back_url` return sends the browser to
 * `.../suscriptores/checkout/success/?preapproval_id=<id>`. Post-HOS-191 that
 * `preapproval_id` is the remaining WEAK second ownership factor on the Tier-1
 * `link-preapproval` call (the primary proof is the authenticated
 * `localSubscriptionId → customerId` chain — see
 * `apps/api/src/services/billing/link-preapproval.service.ts`). Because it
 * rides in the URL query string it leaks into every weak-secrecy channel a
 * query param touches: analytics `$current_url` autocapture (PostHog is active
 * on this app with `capture_pageview: true`), `Referer` headers to any
 * third-party subresource, the visible address bar, and browser history.
 *
 * This snippet removes those parameters from the visible URL via
 * `history.replaceState` before the analytics SDK captures the pageview,
 * shrinking that leak surface. It does NOT (and cannot) undo the initial
 * server access-log line for the first GET — that already happened before any
 * client code runs — so it is one layer of defense-in-depth, not a complete
 * fix on its own.
 *
 * ## Why an inline synchronous snippet (not the React island)
 *
 * The value is safe to strip immediately: the checkout success page reads
 * `preapproval_id` SERVER-SIDE and passes it to `CheckoutStatusPoller` as a
 * prop, so the island never reads it back off `window.location`. Removing it
 * from the client URL therefore cannot break the linking flow.
 *
 * Timing is the whole point, and this is mounted in `BaseLayout`'s `head-early`
 * slot — rendered ahead of every URL-capturing node in `<head>` (only the
 * `charset`/`viewport` metas precede it) — so the `is:inline` script runs
 * synchronously during parse before every path that follows it:
 *
 * - PostHog (`PostHogScript.astro`) stubs `window.posthog` synchronously but
 *   defers the real `$current_url` pageview capture until its `array.js` bundle
 *   loads over the network; by then the parameter is already gone.
 * - The feedback nav bootstrap records `location.pathname + location.search`
 *   into sessionStorage synchronously — running first means it records the
 *   already-scrubbed URL.
 * - Cross-origin subresource fetches (fonts, PostHog assets) that would send a
 *   `Referer` header are all declared later in `<head>`, so their requests
 *   carry the scrubbed URL.
 *
 * The island's `useEffect` (client:load) would hydrate much later and race all
 * of the above, so it is NOT the right layer.
 *
 * The snippet is exported as a plain string so it can be embedded verbatim via
 * `set:html` (mirroring `PostHogScript.astro`) AND executed as-is in a jsdom
 * regression test — the test exercises the exact code that ships, with no risk
 * of the test and the runtime drifting apart.
 */

/**
 * Query-string parameters stripped from the checkout return URL on the client.
 *
 * - `preapproval_id` — the MercadoPago share-link (HOS-191 Path C) preapproval
 *   identifier that doubles as the Tier-1 link-preapproval second factor.
 *
 * Add future provider return-secrets here; the snippet iterates this list, so
 * no other code changes are needed to cover a new parameter.
 */
export const CHECKOUT_RETURN_PARAMS_TO_STRIP = ['preapproval_id'] as const;

/**
 * Self-contained, dependency-free JavaScript embedded as an `is:inline`
 * `<script>` in the checkout success page `<head>` (see
 * {@link StripCheckoutReturnParams}). Runs synchronously during HTML parse and
 * rewrites the visible URL to drop {@link CHECKOUT_RETURN_PARAMS_TO_STRIP},
 * preserving the path, every other query parameter, and the hash. Fully
 * defensive: any failure (older engine, exotic URL) degrades to a no-op rather
 * than throwing during parse.
 *
 * The stripped key list is injected from {@link CHECKOUT_RETURN_PARAMS_TO_STRIP}
 * (not hand-written in the string) so the two never diverge.
 */
export const STRIP_CHECKOUT_RETURN_PARAMS_SNIPPET = `
(function () {
    try {
        var keys = ${JSON.stringify([...CHECKOUT_RETURN_PARAMS_TO_STRIP])};
        var url = new URL(window.location.href);
        var changed = false;
        for (var i = 0; i < keys.length; i++) {
            if (url.searchParams.has(keys[i])) {
                url.searchParams.delete(keys[i]);
                changed = true;
            }
        }
        if (changed) {
            window.history.replaceState(
                window.history.state,
                '',
                url.pathname + url.search + url.hash
            );
        }
    } catch (e) {}
})();
`;
