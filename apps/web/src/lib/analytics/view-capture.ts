/**
 * @file view-capture.ts
 * @description Fire-and-forget view capture beacon for cross-entity view
 * tracking (SPEC-159 T-012).
 *
 * Sends a `POST /api/v1/public/views` request to the backend for every
 * entity page view. Designed to be called from browser context only (React
 * islands / client scripts). Never throws — telemetry must not break pages.
 *
 * ## Beacon transport choice
 *
 * `navigator.sendBeacon` is preferred because it survives page unload and is
 * optimised for fire-and-forget metrics. We pass the body as a `Blob` typed
 * `application/json` so the API's JSON body parser can read it directly.
 *
 * **CORS note:** A `Blob` with `type: 'application/json'` is NOT a "simple"
 * CORS request (the `Content-Type` triggers a preflight OPTIONS). The API
 * CORS configuration explicitly lists `Content-Type` in `allowHeaders`
 * (default: `'Content-Type,Authorization,X-Requested-With'`) and the web
 * origin is in `API_CORS_ORIGINS`, so the preflight succeeds and the beacon
 * goes through. If `sendBeacon` is unavailable or returns `false` (e.g.
 * queued-beacon queue full, header size limit), we fall back to a
 * `fetch(..., { keepalive: true })` which has the same CORS footprint.
 *
 * ## SSR safety
 *
 * All calls are guarded by a `typeof navigator === 'undefined'` check so the
 * module can be imported during SSR without side effects.
 *
 * ## Logging
 *
 * Client-side logging follows `isLoggingEnabled()` from `@/lib/env` — errors
 * are surfaced only in dev builds or when `PUBLIC_ENABLE_LOGGING=true`, so
 * production pages stay noise-free.
 */

import type { TrackableEntityType } from '@repo/schemas';
import { isLoggingEnabled } from '@/lib/env';

/**
 * Entity types accepted by `POST /api/v1/public/views`.
 * Re-exported from `@repo/schemas` (single source of truth) — type-only
 * import, erased at build time, so no runtime cost in the client bundle.
 */
export type ViewEntityType = TrackableEntityType;

/**
 * Input shape for {@link sendViewBeacon}.
 */
export interface SendViewBeaconInput {
    /** Entity category (accommodation, blog post, or event). */
    readonly entityType: ViewEntityType;
    /** UUID of the viewed entity. */
    readonly entityId: string;
}

/**
 * Resolve the API base URL for browser-side use.
 *
 * Uses `import.meta.env.PUBLIC_API_URL` which Vite/Astro injects at build
 * time — the `PUBLIC_` prefix makes it available in the client bundle. Falls
 * back to an empty string so callers get a meaningful relative-URL failure
 * rather than a runtime exception.
 */
function resolveApiBaseUrl(): string {
    const url = import.meta.env.PUBLIC_API_URL as string | undefined;
    return url ? url.replace(/\/$/, '') : '';
}

/**
 * Send a fire-and-forget view beacon to `POST /api/v1/public/views`.
 *
 * Prefers `navigator.sendBeacon`; falls back to `fetch` with `keepalive: true`
 * when sendBeacon is unavailable or returns `false`. Never throws.
 *
 * @param input - Entity type and entity ID to record.
 */
export function sendViewBeacon({ entityType, entityId }: SendViewBeaconInput): void {
    postBeacon({
        path: '/api/v1/public/views',
        payload: JSON.stringify({ entityType, entityId }),
        label: 'view-capture'
    });
}

/**
 * Input shape for {@link sendPartnerLogoClickBeacon}.
 */
export interface SendPartnerLogoClickBeaconInput {
    /** UUID of the partner whose logo was clicked. */
    readonly partnerId: string;
    /** Which linking branch the click followed, per `resolvePartnerLogoLink`. */
    readonly destination: 'OWN_PAGE' | 'EXTERNAL';
}

/**
 * Send a fire-and-forget click beacon to
 * `POST /api/v1/public/partner-logo-clicks` (HOS-1063 A-3).
 *
 * **`sendBeacon` is not a preference here, it is the requirement.** For the
 * `EXTERNAL` destination the visitor is leaving the page in the same tick, and
 * `sendBeacon` is precisely the API that survives unload. The caller must NOT
 * `preventDefault` to "make room" for the request: delaying a navigation to
 * record telemetry trades the visitor's time for a number (AC-5).
 *
 * @param input - Partner id and the destination the click led to.
 */
export function sendPartnerLogoClickBeacon({
    partnerId,
    destination
}: SendPartnerLogoClickBeaconInput): void {
    postBeacon({
        path: '/api/v1/public/partner-logo-clicks',
        payload: JSON.stringify({ partnerId, destination }),
        label: 'partner-logo-click'
    });
}

/**
 * The shared transport behind both beacons.
 *
 * Extracted rather than copied so the two capture paths cannot drift: the CORS
 * footprint, the `sendBeacon`-then-`fetch(keepalive)` ladder and the
 * never-throw contract are properties of the transport, not of either caller,
 * and a second copy is a second place to fix when one of them changes.
 */
function postBeacon({
    path,
    payload,
    label
}: {
    readonly path: string;
    readonly payload: string;
    readonly label: string;
}): void {
    // SSR guard — never call browser APIs during server-side rendering.
    if (typeof navigator === 'undefined') return;

    const url = `${resolveApiBaseUrl()}${path}`;

    try {
        // Attempt sendBeacon first (survives page unload, browser-optimised).
        if (typeof navigator.sendBeacon === 'function') {
            const blob = new Blob([payload], { type: 'application/json' });
            const queued = navigator.sendBeacon(url, blob);
            if (queued) return;
            // queued === false means the browser rejected the beacon (e.g. queue
            // full or payload too large). Fall through to fetch fallback.
            if (isLoggingEnabled()) {
                console.warn(`[${label}] sendBeacon returned false, falling back to fetch`);
            }
        }

        // Fetch fallback with keepalive so the request outlives page navigation.
        fetch(url, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: payload
        }).catch((err: unknown) => {
            if (isLoggingEnabled()) {
                console.warn(`[${label}] fetch fallback failed`, err);
            }
        });
    } catch (err: unknown) {
        // Absolute safety net — telemetry must never crash a page.
        if (isLoggingEnabled()) {
            console.warn(`[${label}] unexpected error`, err);
        }
    }
}
