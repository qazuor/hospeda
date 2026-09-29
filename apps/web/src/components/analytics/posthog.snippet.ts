/**
 * @file posthog.snippet.ts
 * @description The inline PostHog bootstrap `PostHogScript.astro` renders, as a
 * TS constant (HOS-807).
 *
 * It lives here, not in the component frontmatter, so the CSP can hash it at
 * server boot from the very value the component renders
 * (`DEPLOYMENT_CONSTANT_INLINE_SCRIPTS` in `src/lib/csp-soft-nav-script-hashes.ts`).
 * It is injected with `set:html`, so the build-time scan only sees an
 * expression; and only `BaseLayout` renders it, so without the boot hash a
 * `<ClientRouter />` soft navigation from an Auth/Error/Standalone page into a
 * BaseLayout page blocked it and analytics never initialised until a reload.
 *
 * Everything below is the frontmatter it came from, unchanged — see
 * `PostHogScript.astro` for why it is a snippet and not an island.
 */

// Read env vars at template time. `import.meta.env.PUBLIC_*` is baked in at
// build time by Astro, so each Coolify resource (staging vs prod) gets its
// own project key from Coolify's env panel.
const posthogKey = import.meta.env.PUBLIC_POSTHOG_KEY ?? '';
const posthogHost = import.meta.env.PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
const isDev = import.meta.env.DEV === true;
// Deploy version, baked in at build time. Registered as a PostHog super
// property so every captured event carries the app build it came from,
// making it trivial to correlate a spike/regression with a specific release.
const appVersion = import.meta.env.PUBLIC_VERSION ?? 'unknown';

// Compute whether to render the snippet at all. Templates without the key
// render an empty fragment so the page never ships an empty <script> tag.
const shouldRender = !isDev && posthogKey.length > 0;

// Build the snippet body as a plain string and inject it via a single
// `set:html`. The env values are interpolated straight into the string with
// `JSON.stringify(...)` (safe: they are build-time env constants, not user
// input), so the emitted <script> is fully self-contained.
//
// DO NOT reintroduce `define:vars` on this element. `define:vars` + `set:html`
// on the SAME <script> do NOT compose in the production Astro build: the
// `define:vars` wrapper wins and the `set:html` body is dropped, so the page
// ships `<script>(function(){ posthogKey:"…"; })()</script>` — the vars are
// declared but the PostHog loader + `posthog.init` are gone, and
// `window.posthog` never initializes. That silent failure shipped to prod once
// the build-arg fix made `posthogKey` non-empty (before, the empty key made
// `shouldRender=false` so the empty script never appeared). Interpolating the
// values into the string is the only form verified to emit the full snippet —
// see the built-output assertion in apps/web/test/lib/analytics/.
const snippetBody = `
if (!window.__hospeda_posthog_initialized) {
    window.__hospeda_posthog_initialized = true;

    // HOS-369 — hold back the array.js network request without holding back the
    // stub. The anchor lives in a detached DocumentFragment, so the <script> the
    // stub inserts before it never starts loading; \`flushPostHogScript\` moves it
    // into the real head after idle. See the file header for the full rationale.
    var __phHolder = document.createDocumentFragment();
    var __phAnchor = document.createElement('script');
    __phHolder.appendChild(__phAnchor);
    var __phDoc = {
        createElement: function (tagName) {
            return document.createElement(tagName);
        },
        getElementsByTagName: function (tagName) {
            return tagName === 'script' ? [__phAnchor] : document.getElementsByTagName(tagName);
        }
    };

    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]);t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init me Te Ee Re capture De calculateEventProperties Oe register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Ce $e createPersonProfile Ie opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing _t debug L getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(__phDoc,window.posthog||[]);

(function () {
    function readAnalyticsConsent() {
        try {
            var found = document.cookie.split('; ').find(function (c) {
                return c.indexOf('cookie-consent=') === 0;
            });
            if (!found) {
                return false;
            }
            var parsed = JSON.parse(decodeURIComponent(found.slice('cookie-consent='.length)));
            return !!(parsed && parsed.analytics === true);
        } catch (e) {
            return false;
        }
    }

    function resolveEnvironment() {
        var host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1' || host.indexOf('.local') !== -1) {
            return 'development';
        }
        if (host.indexOf('staging') !== -1) {
            return 'staging';
        }
        if (host.indexOf('preview') !== -1) {
            return 'preview';
        }
        if (host.indexOf('test') !== -1) {
            return 'test';
        }
        return 'production';
    }

    function syncCaptureConsent(allowed) {
        if (!window.posthog || typeof window.posthog.set_config !== 'function') {
            return;
        }
        window.posthog.set_config({
            persistence: allowed ? 'localStorage+cookie' : 'memory'
        });
    }

    window.posthog.init(${JSON.stringify(posthogKey)}, {
        api_host: ${JSON.stringify(posthogHost)},
        person_profiles: 'identified_only',
        capture_pageview: 'history_change',
        capture_pageleave: false,
        autocapture: false,
        capture_performance: { web_vitals: true },
        disable_session_recording: true,
        disable_surveys: true,
        persistence: readAnalyticsConsent() ? 'localStorage+cookie' : 'memory',
        respect_dnt: true,
        loaded: function (ph) {
            ph.register({
                app: 'web',
                environment: resolveEnvironment(),
                app_version: ${JSON.stringify(appVersion)}
            });
        }
    });

    window.addEventListener('cookie-consent:changed', function (event) {
        var detail = event && event.detail;
        syncCaptureConsent(!!(detail && detail.analytics === true));
    });

    // Move the stub's <script> from the detached fragment into the real head,
    // which is what actually starts the array.js request. Idempotent.
    function flushPostHogScript() {
        if (window.__hospeda_posthog_script_flushed) {
            return;
        }
        window.__hospeda_posthog_script_flushed = true;

        var el = __phHolder.querySelector('script[src]');
        if (!el) {
            // Fail-safe: the upstream stub did not inject where the proxy could
            // capture it. Build the request ourselves rather than let analytics
            // die silently.
            el = document.createElement('script');
            el.type = 'text/javascript';
            el.crossOrigin = 'anonymous';
            el.async = true;
            el.src =
                ${JSON.stringify(posthogHost)}.replace('.i.posthog.com', '-assets.i.posthog.com') +
                '/static/array.js';
        }
        document.head.appendChild(el);
    }

    function schedulePostHogScript() {
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(flushPostHogScript, { timeout: 3000 });
        } else {
            window.setTimeout(flushPostHogScript, 1000);
        }
    }

    if (document.readyState === 'complete') {
        schedulePostHogScript();
    } else {
        window.addEventListener('load', schedulePostHogScript, { once: true });
    }
})();
}
`;

/**
 * The PostHog bootstrap script body, or `null` when it must not render (dev
 * builds, or no project key configured).
 */
export const POSTHOG_INLINE_SNIPPET: string | null = shouldRender ? snippetBody : null;
