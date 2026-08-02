/**
 * @file feedback-nav-bootstrap.snippet.ts
 * @description Inline-script source that records the visitor's recent
 * navigation into `sessionStorage`, so the feedback FAB can attach it to a
 * report ("Opción A" nav-history bootstrap).
 *
 * ## Why the source lives in a `.ts` constant instead of inline in the layout
 *
 * `BaseLayout.astro` renders this script inside a conditional expression
 * (`{feedbackEnabled && (...)}`). Authoring the JS directly as the children of
 * an `is:inline` script in that position does NOT work: Astro treats the
 * children of an `is:inline` script as RAW TEXT, so a `{\`…\`}` wrapper — the
 * natural way to stop the compiler choking on JS operators inside an
 * expression container — is emitted *verbatim* into the document. The browser
 * then parses a block statement wrapping a template literal: valid JavaScript,
 * zero effect. The bootstrap silently never ran.
 *
 * Exporting the source as a string and passing it through `set:html` sidesteps
 * the expression container entirely, and matches the pattern already used by
 * `PostHogScript.astro` and `StripCheckoutReturnParams.astro`.
 *
 * ## Why inline and synchronous (not the FAB island)
 *
 * The FAB hydrates with `client:idle`. Navigation that happens before that —
 * including the very first pageview — would be lost. This snippet installs its
 * `history.pushState`/`replaceState` hooks during parse, and persists to
 * `sessionStorage` so the record also survives full page reloads.
 *
 * No CSP attribute is needed: `middleware.ts` hashes inline blocks by content
 * (HOS-369 WB0-1).
 */

/**
 * `sessionStorage` key holding the recent-navigation array.
 *
 * CONTRACT: this must stay identical to `SS_NAV_KEY` in
 * `packages/feedback/src/lib/runtime-trackers.ts`, which reads the array back
 * and surfaces it as `environment.navigationHistory` on the report. The
 * constant is duplicated rather than imported on purpose: importing from
 * `@repo/feedback` here would pull that package's barrel (and its React widget)
 * into `BaseLayout`'s graph for the sake of one string. The duplication is
 * pinned instead by `test/lib/feedback/feedback-nav-bootstrap.test.ts`, which
 * reads both files and fails if they diverge.
 */
export const FEEDBACK_NAV_STORAGE_KEY = '__hospeda_feedback_nav__';

/**
 * Maximum number of navigation entries retained. Mirrors `MAX_NAV_HISTORY` in
 * the same `runtime-trackers.ts` — same contract, same test.
 */
export const FEEDBACK_NAV_MAX_ENTRIES = 10;

/**
 * The bootstrap source, as executable JavaScript text.
 *
 * ES5-only and self-guarding (`window.__hospedaFeedbackBootstrapped`): it runs
 * before any bundle, on whatever the visitor's browser is, and must never
 * throw — a failure here would be a parse error at the top of every page.
 */
export const FEEDBACK_NAV_BOOTSTRAP_SNIPPET = `
(function () {
    if (window.__hospedaFeedbackBootstrapped) return;
    window.__hospedaFeedbackBootstrapped = true;
    var SS_KEY = '${FEEDBACK_NAV_STORAGE_KEY}';
    var MAX = ${FEEDBACK_NAV_MAX_ENTRIES};
    function read() {
        try {
            var raw = sessionStorage.getItem(SS_KEY);
            var parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }
    function write(nav) {
        try { sessionStorage.setItem(SS_KEY, JSON.stringify(nav)); } catch (e) {}
    }
    function push(url) {
        if (!url) return;
        var nav = read();
        if (nav[nav.length - 1] === url) return;
        nav.push(url);
        if (nav.length > MAX) nav = nav.slice(-MAX);
        write(nav);
    }
    function current() {
        try { return location.pathname + location.search; }
        catch (e) { return ''; }
    }
    push(current());
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    history.pushState = function () {
        var r = origPush.apply(this, arguments);
        push(current());
        return r;
    };
    history.replaceState = function () {
        var r = origReplace.apply(this, arguments);
        push(current());
        return r;
    };
    window.addEventListener('popstate', function () { push(current()); });
    document.addEventListener('astro:after-swap', function () { push(current()); });
})();
`;
