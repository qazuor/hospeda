/**
 * @file umami-loader.ts
 * @description Loads the Umami tracker only after the visitor grants the
 * `analytics` consent category (HOS-2681, owner decision).
 *
 * `UmamiScript.astro` renders an inert `<meta name="umami-config">` on every
 * page (no per-user data, so pages stay session-blind). This module reads it
 * on the client and:
 * - injects the tracker `<script>` once `getConsent()?.analytics === true`,
 *   at start-up for a returning visitor or on `CONSENT_CHANGED_EVENT` for one
 *   who just accepted in the banner (no reload);
 * - injects nothing, so Umami sends and loads nothing, until then. Events
 *   fired meanwhile are dropped by the gates in `umami-client.ts` and
 *   `umami-pageview.ts`, never queued;
 * - on revoke, sets Umami's own `umami.disabled` localStorage flag, which a
 *   loaded tracker checks before every send (including its `data-umami-event`
 *   click handlers), and removes it again on a later grant. The loaded script
 *   cannot be unloaded, so the flag plus the client gates are what stop it.
 *
 * The script carries `data-auto-pageview="false"`: pageviews come from
 * `umami-pageview.ts` (see there for why). It is injected into `<head>` and
 * flagged `data-astro-transition-persist` so the router keeps it.
 */

import { readUmamiConfig } from '@/lib/analytics/umami-tracker';
import { CONSENT_CHANGED_EVENT, getConsent } from '@/lib/cookie-consent';

/** `id` of the injected tracker script. */
export const UMAMI_TRACKER_SCRIPT_ID = 'umami-tracker';

/** localStorage key Umami's tracker reads to disable itself. */
export const UMAMI_DISABLED_STORAGE_KEY = 'umami.disabled';

let started = false;

function setTrackerDisabled(disabled: boolean): void {
    try {
        if (disabled) window.localStorage.setItem(UMAMI_DISABLED_STORAGE_KEY, '1');
        else window.localStorage.removeItem(UMAMI_DISABLED_STORAGE_KEY);
    } catch {
        // Storage can be blocked; the client gates still stop every send.
    }
}

/** Injects the tracker script once. Only called with analytics consent. */
function injectTracker(): void {
    if (document.getElementById(UMAMI_TRACKER_SCRIPT_ID)) return;
    const config = readUmamiConfig();
    if (!config) return;
    const script = document.createElement('script');
    script.id = UMAMI_TRACKER_SCRIPT_ID;
    script.src = config.scriptUrl;
    script.defer = true;
    script.setAttribute('data-website-id', config.websiteId);
    script.setAttribute('data-auto-pageview', 'false');
    script.setAttribute('data-astro-transition-persist', UMAMI_TRACKER_SCRIPT_ID);
    document.head.appendChild(script);
}

function onConsentChanged(event: Event): void {
    const detail = (event as CustomEvent<{ analytics?: boolean }>).detail;
    if (detail?.analytics === true) {
        setTrackerDisabled(false);
        injectTracker();
        return;
    }
    // Revoked (or declined): only a document that loaded the tracker needs the flag.
    if (document.getElementById(UMAMI_TRACKER_SCRIPT_ID)) setTrackerDisabled(true);
}

/** Result of {@link startUmamiLoader}. */
export interface StartUmamiLoaderResult {
    /** Removes the listener and forgets the start (tests). */
    readonly stop: () => void;
}

/**
 * Wires the consent-gated tracker load. Idempotent; a no-op on the server and
 * on pages without the Umami config. Called from the bundled script in
 * `UmamiScript.astro`, which the router never re-runs on a swap.
 *
 * @returns A handle whose `stop` undoes the wiring (tests).
 */
export function startUmamiLoader(): StartUmamiLoaderResult {
    const noop: StartUmamiLoaderResult = { stop: () => undefined };
    if (started || typeof window === 'undefined') return noop;
    if (!readUmamiConfig()) return noop;
    started = true;
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
    if (getConsent()?.analytics === true) {
        setTrackerDisabled(false);
        injectTracker();
    }
    return {
        stop: () => {
            window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
            started = false;
        }
    };
}
