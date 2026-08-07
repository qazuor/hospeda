/**
 * @file rewrite-async-stylesheets.ts
 * @description Rewrites the render-blocking `<link rel="stylesheet"
 * href="/_astro/*.css">` tags Astro emits for COMPONENT stylesheets into
 * non-blocking ones, while keeping PAGE and LAYOUT stylesheets blocking
 * (HOS-369, follow-up to WB0-1's `CriticalStyles.astro`).
 *
 * ## Why this exists
 *
 * `build.inlineStylesheets: 'never'` (astro.config.mjs) forces every
 * component's scoped `<style>` out to its own external, content-hashed
 * `/_astro/<Name>.<hash>.css` file (the alternative, `'auto'`, breaks
 * `<ClientRouter />` soft-nav — see the config comment). Each of those is a
 * plain `<link rel="stylesheet">` in `<head>`, which blocks first paint until
 * it downloads. Staging measurement (HOS-369): the home page's HTML is
 * complete at ~997ms but first paint waits until ~2,473ms, gated by 16
 * render-blocking stylesheets (~41KB transferred); an earlier 15KB cut from
 * this set (`CriticalStyles.astro` inlining `global.css`) already measured
 * ~156ms of LCP improvement, so the relationship between blocking KB and LCP
 * is empirically established, not assumed.
 *
 * The PAGE's own stylesheet (`index.<hash>.css`) and every LAYOUT shell
 * (`BaseLayout`, `ListingLayout`, ... — anything ending in `Layout`) style
 * content that is visible in the very first paint; unstyled chrome flashing
 * before it is styled (FOUC) is unacceptable there. Everything else —
 * individual component stylesheets (cards, buttons, filters, ...) — can load
 * without blocking paint, because by the time the component's markup is
 * usable the stylesheet has almost certainly already arrived (non-blocking
 * `<link>`s are still fetched at normal priority, just not paint-blocking).
 *
 * ## Where this runs
 *
 * `src/middleware.ts`, Step 9, BEFORE `collectCspHashes()`. That order is
 * load-bearing: this function injects an inline `<script>` (see
 * `ASYNC_CSS_ACTIVATION_SCRIPT_CONTENT`) that flips the deferred stylesheets
 * back to `media="all"` once the DOM has parsed them. If the CSP hash were
 * computed BEFORE this rewrite, that script's hash would never make it into
 * `script-src`, the browser would block it, and every deferred stylesheet
 * would silently never activate — the page would stay permanently unstyled
 * for those components. `test/integration/async-css-emission.test.ts` pins
 * this ordering end-to-end.
 *
 * ## Byte-identical script, same reasoning as `CriticalStyles.astro`
 *
 * The CSP that stays active after an Astro `<ClientRouter />` soft
 * navigation is the one stamped for the FIRST page load in that session, not
 * a fresh one for each swapped-in page. So `ASYNC_CSS_ACTIVATION_SCRIPT_CONTENT`
 * MUST be the exact same string on every single page — if two pages emitted
 * differently-hashed activation scripts, only the one from the first page
 * load would ever be allowed, and every OTHER page's copy would be blocked
 * post-soft-nav, silently stranding its component stylesheets at
 * `media="print"` forever. It is therefore injected UNCONDITIONALLY on every
 * SSR HTML response processed here, even one with zero deferred stylesheets
 * — never composed from any per-response data.
 *
 * @see .specs/HOS-369-web-performance-edge-cache/spec.md
 */

/**
 * Stylesheet basenames (the `<Name>` in `/_astro/<Name>.<hash>.css`) that
 * MUST stay render-blocking.
 *
 * Criterion: **above-the-fold — its FOUC would be visible in the very first
 * paint.** Conservative by design: when in doubt, a stylesheet stays
 * blocking rather than risk a flash of unstyled above-the-fold content.
 *
 * - `index` — every route's OWN page-level stylesheet.
 * - Anything ending in `Layout` — the shared shell (`BaseLayout`,
 *   `ListingLayout`, `DetailLayout`, ...) that wraps `<html>`/`<body>`.
 * - `WaveHeader` / `ListingPageHeader` — the solid band at the top of
 *   listing/detail pages, rendered above the fold on those routes.
 */
export const BLOCKING_STYLESHEET_ALLOWLIST_PATTERNS: readonly RegExp[] = [
    /^index$/,
    /Layout$/,
    /^WaveHeader$/,
    /^ListingPageHeader$/
];

/**
 * Whether a stylesheet basename (extracted from its `/_astro/<name>.<hash>.css`
 * href) must stay render-blocking per `BLOCKING_STYLESHEET_ALLOWLIST_PATTERNS`.
 *
 * @param args - name: the basename portion of the stylesheet's filename.
 * @returns true if the stylesheet must remain blocking.
 */
export function isBlockingStylesheetName({ name }: { readonly name: string }): boolean {
    return BLOCKING_STYLESHEET_ALLOWLIST_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Marker attribute added to a stylesheet `<link>` deferred by this module,
 * read by the activation script to find which links to reactivate.
 */
const ASYNC_CSS_MARKER_ATTR = 'data-async-css';

/**
 * Marker attribute on the injected activation `<script>`, purely for
 * identification in tests/debugging — it does not affect the CSP hash (a
 * hash covers only the element's text content, never its attributes).
 */
const ACTIVATION_SCRIPT_MARKER_ATTR = 'data-async-css-activator';

/**
 * Inline script body (no `<script>` wrapper) that reactivates every deferred
 * stylesheet once the DOM has parsed them. MUST be a fixed literal — see the
 * module JSDoc "byte-identical script" section. No per-request interpolation,
 * ever.
 *
 * `media="print"` makes the browser fetch the stylesheet at normal priority
 * without blocking paint (print is never the active output medium for a
 * screen render). Flipping `media` to `"all"` re-applies it — CSSOM already
 * has (or is finishing) the download, so this does not trigger a second
 * fetch.
 */
export const ASYNC_CSS_ACTIVATION_SCRIPT_CONTENT =
    "document.querySelectorAll('[data-async-css]').forEach(function(link){link.media='all';});";

/** Matches exactly the `<link rel="stylesheet" href="/_astro/*.css">` tag shape Astro emits for external component/page/layout stylesheets (verified against a production build across the home, listing, and static-page routes). */
const ASTRO_STYLESHEET_LINK_RE =
    /<link rel="stylesheet" href="(\/_astro\/([^"./]+)\.[^"./]+\.css)">/g;

interface RewriteAsyncStylesheetsArgs {
    readonly html: string;
}

interface RewriteAsyncStylesheetsResult {
    /** The HTML with non-allowlisted stylesheets deferred and the activation script injected. */
    readonly html: string;
    /** Hrefs of every stylesheet that was deferred (for tests/telemetry — empty when none matched). */
    readonly deferredHrefs: readonly string[];
}

/**
 * Defers every Astro-emitted component stylesheet NOT in
 * `BLOCKING_STYLESHEET_ALLOWLIST_PATTERNS` from render-blocking to
 * `media="print"` + async activation, and injects the fixed activation
 * script (always, even when nothing was deferred — see module JSDoc).
 *
 * A `<noscript>` fallback carrying the plain, unconditionally-blocking
 * `<link>` is emitted right after every deferred stylesheet, so visitors
 * without JavaScript (and crawlers that do not execute it) still receive the
 * component styling.
 *
 * If a candidate `<link>` tag does not match `ASTRO_STYLESHEET_LINK_RE`
 * exactly (e.g. a future Astro version adds an attribute), it is left
 * completely untouched — the safe failure mode is "stays blocking", not
 * "silently breaks".
 *
 * @param args - html: the full rendered HTML document.
 * @returns The rewritten HTML plus the hrefs that were deferred.
 */
export function rewriteAsyncStylesheets({
    html
}: RewriteAsyncStylesheetsArgs): RewriteAsyncStylesheetsResult {
    const deferredHrefs: string[] = [];

    const rewrittenHtml = html.replace(ASTRO_STYLESHEET_LINK_RE, (match, href, name) => {
        if (isBlockingStylesheetName({ name })) {
            return match;
        }
        deferredHrefs.push(href);
        return (
            `<link rel="stylesheet" href="${href}" media="print" ${ASYNC_CSS_MARKER_ATTR}>` +
            `<noscript><link rel="stylesheet" href="${href}"></noscript>`
        );
    });

    return {
        html: injectActivationScript({ html: rewrittenHtml }),
        deferredHrefs
    };
}

/**
 * Injects the fixed activation script right before `</body>`, so it runs
 * after every stylesheet `<link>` in `<head>` (and the rest of the body) has
 * already been parsed into the DOM. Falls back to appending at the very end
 * if `</body>` is not found (defensive; every Astro-rendered document has one).
 */
function injectActivationScript({ html }: { readonly html: string }): string {
    const scriptTag = `<script ${ACTIVATION_SCRIPT_MARKER_ATTR}>${ASYNC_CSS_ACTIVATION_SCRIPT_CONTENT}</script>`;
    const bodyCloseIndex = html.lastIndexOf('</body>');

    if (bodyCloseIndex === -1) {
        return html + scriptTag;
    }

    return html.slice(0, bodyCloseIndex) + scriptTag + html.slice(bodyCloseIndex);
}
