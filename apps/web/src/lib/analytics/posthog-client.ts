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
    setPersonProperties(props: Record<string, unknown>): void;
    group(groupType: string, groupKey: string, groupProperties?: Record<string, unknown>): void;
    resetGroups(): void;
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
/**
 * Person properties requested before analytics consent was granted. Merged
 * across calls and flushed the moment consent flips to `true`. `null` means
 * nothing pending. Kept separate from {@link pendingIdentify} because person
 * properties can be set without (re-)identifying.
 */
let pendingPersonProperties: Record<string, unknown> | null = null;
/**
 * Group association requested before analytics consent was granted, flushed the
 * moment consent flips to `true`. Only the latest association per group type is
 * kept (a re-association supersedes an earlier pending one).
 */
let pendingGroups: Record<string, string> = {};
/** Guard so the `cookie-consent:changed` listener is attached at most once. */
let consentListenerAttached = false;

function attachConsentListenerOnce(): void {
    if (consentListenerAttached || typeof window === 'undefined') return;
    consentListenerAttached = true;
    window.addEventListener('cookie-consent:changed', (event) => {
        const detail = (event as CustomEvent<{ analytics?: boolean }>).detail;
        if (detail?.analytics !== true) return;
        if (pendingIdentify) {
            window.posthog?.identify(pendingIdentify.userId, pendingIdentify.props);
            pendingIdentify = null;
        }
        if (pendingPersonProperties) {
            window.posthog?.setPersonProperties(pendingPersonProperties);
            pendingPersonProperties = null;
        }
        for (const [groupType, groupKey] of Object.entries(pendingGroups)) {
            window.posthog?.group(groupType, groupKey);
        }
        pendingGroups = {};
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
 * Set durable person properties on the current PostHog person profile (e.g.
 * `plan`, `plan_status`). Like {@link identifyUser} this writes to a person
 * profile, so it is CONSENT-GATED: applied immediately when consent is already
 * granted, otherwise merged into a pending buffer and flushed the moment
 * consent flips to `true`. No-op on the server and when PostHog never loaded.
 *
 * @param props - Non-sensitive person properties to set. Never pass PII.
 */
export function setPersonProperties(props: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;
    if (hasAnalyticsConsent()) {
        window.posthog?.setPersonProperties(props);
        return;
    }
    pendingPersonProperties = { ...(pendingPersonProperties ?? {}), ...props };
    attachConsentListenerOnce();
}

/**
 * Associate subsequent events with a PostHog group (e.g. `accommodation`), so
 * analytics can aggregate at the entity level (unique users per accommodation,
 * group-level funnels).
 *
 * CONSENT-GATED like {@link identifyUser}: applied immediately when consent is
 * granted, otherwise buffered and flushed on consent. No-op on the server / when
 * PostHog never loaded.
 *
 * NOTE: `group()` persists on the session until the next association or reset,
 * and only has an effect once the matching group type is configured in the
 * PostHog project (a manual/ops step, plan-dependent). Until then this is a
 * harmless no-op on PostHog's side.
 *
 * @param groupType - The group type slug (e.g. `'accommodation'`).
 * @param groupKey - The concrete group id (e.g. the accommodation id).
 */
export function associateGroup(groupType: string, groupKey: string): void {
    if (typeof window === 'undefined') return;
    if (hasAnalyticsConsent()) {
        window.posthog?.group(groupType, groupKey);
        return;
    }
    pendingGroups = { ...pendingGroups, [groupType]: groupKey };
    attachConsentListenerOnce();
}

/**
 * Clear ALL current group associations for the session. Call when leaving the
 * context that set a group (e.g. unmounting an accommodation detail page) so the
 * association does not leak onto events captured on unrelated pages afterwards —
 * `group()` otherwise persists until superseded or reset. Also drops any group
 * association that was still pending consent. No-op on the server / when PostHog
 * never loaded.
 */
export function resetGroups(): void {
    if (typeof window === 'undefined') return;
    pendingGroups = {};
    window.posthog?.resetGroups();
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
    pendingPersonProperties = null;
    pendingGroups = {};
    window.posthog?.reset();
}
