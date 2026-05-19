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
