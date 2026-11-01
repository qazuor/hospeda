/**
 * @file dialog-history.pop-guard.snippet.ts
 * @description Inline-script source that registers a `popstate` listener AHEAD
 * of Astro's `<ClientRouter />`, so `dialog-history` can keep a traversal onto
 * or off one of its raw entries from the router (HOS-1927).
 *
 * ## Why this exists
 *
 * `dialog-history` used to do this with a CAPTURE listener on `window`. That
 * does not work: `window` is the event target itself, and Chromium fires target
 * listeners in registration order, capture or not (measured on staging). The
 * router registers its listener when its module loads, long before an island
 * hydrates, so it ran first, fetched the entry's URL and swapped the listing
 * back to the previous search. The jsdom tests could not see it, because they
 * registered their fake router AFTER the module under test.
 *
 * This snippet runs during parse, before the router's module executes, so its
 * listener is first. It owns no logic: `dialog-history` installs the decision
 * as `handler` when it loads; until then (and on pages without a claim) it is
 * inert.
 *
 * No CSP attribute is needed: `middleware.ts` hashes inline blocks by content.
 *
 * @module dialog-history.pop-guard.snippet
 */

/** Property on `window` that carries the guard. */
export const POP_GUARD_KEY = '__hospedaPopGuard';

/** Shape of the guard object the snippet installs. */
export interface PopGuard {
    /** Returns `true` when the router must not see the traversal. */
    handler: (() => boolean) | null;
}

/** `window` as seen by `dialog-history`. */
export type PopGuardWindow = Window & { [POP_GUARD_KEY]?: PopGuard };

/** Source of the inline script. Must stay ES5 and self-contained. */
export const DIALOG_POP_GUARD_SNIPPET = `
(function () {
    if (window.${POP_GUARD_KEY}) return;
    var guard = { handler: null };
    window.${POP_GUARD_KEY} = guard;
    window.addEventListener('popstate', function (event) {
        var handler = guard.handler;
        if (!handler) return;
        var swallow = false;
        try { swallow = handler() === true; } catch (e) { swallow = false; }
        if (swallow) event.stopImmediatePropagation();
    });
})();
`;
