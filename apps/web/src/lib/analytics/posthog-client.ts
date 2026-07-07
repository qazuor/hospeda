/**
 * @file posthog-client.ts
 * @description Typed wrapper around `window.posthog.capture(...)` for the
 * web app (SPEC-140 — fix B).
 *
 * Initialisation is handled entirely by the inline snippet in
 * `src/components/analytics/PostHogScript.astro` (mounted from
 * `BaseLayout.astro`). This module is intentionally thin so call sites can
 * keep importing `trackEvent` without worrying about whether the SDK has
 * finished loading — the official PostHog snippet stubs `window.posthog`
 * with a queueing array.js loader, so `.capture()` calls before full SDK
 * load are deferred and replayed automatically.
 *
 * Why not bundle posthog-js via ESM here:
 * The previous SPEC-140 implementation imported `posthog-js` and called
 * `posthog.init(...)` from a React island. That collided with PostHog's own
 * array.js auto-loader and left the SDK in a half-state where events never
 * POSTed to `/e/`. The official PostHog Astro guide uses the inline snippet
 * pattern (see PostHogScript.astro for details).
 */

/**
 * Shape of the `window.posthog` handle exposed by the inline snippet. Only
 * the methods used directly by app code are declared; the runtime stub
 * exposes many more (identify, opt_in_capturing, etc.).
 */
interface PostHogStub {
    capture(name: string, props?: Record<string, unknown>): void;
    set_config(config: Record<string, unknown>): void;
    identify(distinctId: string, props?: Record<string, unknown>): void;
    reset(): void;
}

declare global {
    interface Window {
        readonly posthog?: PostHogStub;
    }
}

/**
 * Capture a custom event via the PostHog browser SDK.
 *
 * Safe to call at any time:
 * - On the server: short-circuits (no-op when `window` is undefined).
 * - Before the SDK finishes loading: PostHog's snippet stub queues the
 *   call and replays it once the real SDK is ready.
 * - When the env var is unset or running in dev mode: `window.posthog`
 *   never gets stubbed (PostHogScript.astro skips render), so the optional
 *   chain short-circuits and the call is a true no-op.
 *
 * Prefer importing event names from `./events.ts` over passing string
 * literals — the catalog makes the event surface discoverable + typed.
 *
 * @param name - Event name (use values from {@link ./events}).
 * @param props - Optional event properties; serialised to PostHog as-is.
 */
export function trackEvent(name: string, props?: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;
    window.posthog?.capture(name, props);
}

/**
 * Read the `cookie-consent` cookie and report whether the visitor granted
 * analytics consent (`analytics === true`). Mirrors the exact gate the inline
 * snippet in `PostHogScript.astro` uses to decide `persistence`. Returns
 * `false` on any parse error or when the cookie is absent (privacy-safe
 * default). Server-safe: returns `false` when `document` is unavailable.
 */
function hasAnalyticsConsent(): boolean {
    if (typeof document === 'undefined') return false;
    try {
        const found = document.cookie.split('; ').find((c) => c.indexOf('cookie-consent=') === 0);
        if (!found) return false;
        const parsed = JSON.parse(decodeURIComponent(found.slice('cookie-consent='.length)));
        return !!(parsed && parsed.analytics === true);
    } catch {
        return false;
    }
}

/**
 * When `identifyUser` is called before analytics consent is granted, the
 * requested identity is stashed here and applied later, the moment consent
 * flips to `true` via the `cookie-consent:changed` event (dispatched by
 * `cookie-consent.ts`). `null` means nothing pending.
 */
let pendingIdentify: { userId: string; props?: Record<string, unknown> } | null = null;
/** Guard so the `cookie-consent:changed` listener is attached at most once. */
let consentListenerAttached = false;

function attachConsentListenerOnce(): void {
    if (consentListenerAttached || typeof window === 'undefined') return;
    consentListenerAttached = true;
    window.addEventListener('cookie-consent:changed', (event) => {
        const detail = (event as CustomEvent<{ analytics?: boolean }>).detail;
        if (detail?.analytics === true && pendingIdentify) {
            window.posthog?.identify(pendingIdentify.userId, pendingIdentify.props);
            pendingIdentify = null;
        }
    });
}

/**
 * Identify the current visitor to PostHog so their events (across devices,
 * once logged in) are grouped under a stable person profile instead of an
 * anonymous distinct id.
 *
 * CONSENT-GATED. `identify()` sends the real user id to PostHog's servers and
 * creates a durable person profile, so — unlike anonymous `capture()` — it may
 * only fire once the visitor has granted analytics consent. This function
 * therefore:
 * - fires `identify()` immediately when consent is already granted;
 * - otherwise stashes the identity and replays it the moment consent flips to
 *   `true` (via the `cookie-consent:changed` event), so a user who logs in and
 *   *then* accepts cookies still gets identified without a reload.
 *
 * `person_profiles` is configured as `'identified_only'` (see
 * `PostHogScript.astro`), so calling this is what actually creates a person
 * profile for the user — without it, every event from a logged-in visitor
 * stays anonymous. Idempotent (safe to call repeatedly with the same id).
 * No-op on the server, and (via the optional chain) when PostHog never loaded
 * (dev mode / missing key). Note: the snippet IS rendered even without
 * consent — it just uses `memory` persistence — so `window.posthog` exists;
 * the consent gate here, not the snippet, is what withholds `identify()`.
 *
 * @param userId - Stable app user id (Better Auth user.id). Never pass an
 *   email or other PII as the distinct id.
 * @param props - Optional non-sensitive person properties.
 */
export function identifyUser(userId: string, props?: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;
    if (hasAnalyticsConsent()) {
        window.posthog?.identify(userId, props);
        return;
    }
    // No consent yet: defer until the visitor accepts analytics cookies.
    pendingIdentify = { userId, props };
    attachConsentListenerOnce();
}

/**
 * Clear the identified visitor. Call on sign-out so events captured on the
 * same browser afterwards (by a different user, or as a guest) are not
 * attributed to the previous person. Also drops any identity that was pending
 * consent, so a signed-out user is never identified retroactively.
 */
export function resetUser(): void {
    if (typeof window === 'undefined') return;
    pendingIdentify = null;
    window.posthog?.reset();
}
