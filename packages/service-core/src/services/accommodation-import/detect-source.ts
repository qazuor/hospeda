/**
 * Accommodation Import — Source Detector (SPEC-222)
 *
 * Inspects a URL string and returns the {@link ImportSource} enum value that
 * best matches the hosting platform. Used by the import orchestrator to select
 * the appropriate adapter before any HTTP call is made.
 *
 * Detection is intentionally cheap: one URL parse + hostname string checks.
 * No network I/O, no external dependencies.
 *
 * @module services/accommodation-import/detect-source
 */

import type { ImportSource } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalises a raw hostname for reliable comparison.
 *
 * - Converts to lower-case (handles upper-case hosts like `WWW.Airbnb.COM`)
 * - Strips a leading `www.` prefix so `www.booking.com` and `booking.com`
 *   both match the same rule.
 *
 * @param raw - The raw hostname string from a parsed URL.
 * @returns The normalised hostname.
 */
function normaliseHostname(raw: string): string {
    const lower = raw.toLowerCase();
    return lower.startsWith('www.') ? lower.slice(4) : lower;
}

// ---------------------------------------------------------------------------
// detectSource
// ---------------------------------------------------------------------------

/**
 * Detects the import source platform from a URL string.
 *
 * Normalises the hostname (lowercase, strips leading `www.`) and applies a
 * priority-ordered set of pattern checks to identify the platform. Falls back
 * to `'generic'` for any URL that does not match a known platform, and also
 * for unparseable / malformed URL strings (no throw).
 *
 * **Return values:**
 * - `'mercadolibre'` — MercadoLibre / MercadoLivre real-estate listings
 * - `'google'`       — Google Maps and short-link domains
 * - `'booking'`      — Booking.com property pages
 * - `'airbnb'`       — Airbnb listing pages (any TLD)
 * - `'generic'`      — Any other URL, or an unparseable string
 *
 * **Never returns `'none'`** — that value is reserved for accommodations with
 * no external source (manual entry). Detection always produces a positive
 * platform match or `'generic'`.
 *
 * @param input - Object containing the raw URL string to inspect.
 * @returns The detected {@link ImportSource} value.
 *
 * @example
 * ```ts
 * detectSource({ url: 'https://www.airbnb.com.ar/rooms/12345' });
 * // → 'airbnb'
 *
 * detectSource({ url: 'https://articulo.mercadolibre.com.ar/MLA-123-x' });
 * // → 'mercadolibre'
 *
 * detectSource({ url: 'https://maps.app.goo.gl/AbCdEf' });
 * // → 'google'
 *
 * detectSource({ url: 'https://www.booking.com/hotel/ar/sol.html' });
 * // → 'booking'
 *
 * detectSource({ url: 'https://example.com/listing/42' });
 * // → 'generic'
 *
 * detectSource({ url: 'not-a-url' });
 * // → 'generic'  (no throw)
 * ```
 */
export function detectSource(input: { readonly url: string }): ImportSource {
    let parsed: URL;

    try {
        parsed = new URL(input.url);
    } catch {
        // Unparseable URL — degrade to generic, never throw
        return 'generic';
    }

    const hostname = normaliseHostname(parsed.hostname);
    const fullUrl = input.url.toLowerCase();

    // -----------------------------------------------------------------------
    // MercadoLibre / MercadoLivre
    // Covers: mercadolibre.com.ar, mercadolibre.com, mercadolibre.com.mx,
    //         articulo.mercadolibre.*, produto.mercadolivre.com.br, etc.
    // -----------------------------------------------------------------------
    if (
        hostname.includes('mercadolibre.') ||
        hostname.includes('mercadolic') ||
        hostname.includes('mercadolivre.')
    ) {
        return 'mercadolibre';
    }

    // -----------------------------------------------------------------------
    // Google Maps
    // Covers: maps.google.*, google.com/maps, goo.gl/maps,
    //         maps.app.goo.gl, g.page
    // -----------------------------------------------------------------------
    if (
        hostname.startsWith('maps.google.') ||
        hostname === 'g.page' ||
        hostname === 'maps.app.goo.gl' ||
        (hostname === 'goo.gl' && fullUrl.includes('/maps')) ||
        (hostname.startsWith('google.') && fullUrl.includes('/maps'))
    ) {
        return 'google';
    }

    // -----------------------------------------------------------------------
    // Booking.com
    // -----------------------------------------------------------------------
    if (hostname.includes('booking.com')) {
        return 'booking';
    }

    // -----------------------------------------------------------------------
    // Airbnb (any TLD: airbnb.com, airbnb.com.ar, airbnb.mx, airbnb.es, …)
    // -----------------------------------------------------------------------
    if (hostname.includes('airbnb.')) {
        return 'airbnb';
    }

    // -----------------------------------------------------------------------
    // Generic fallback
    // -----------------------------------------------------------------------
    return 'generic';
}
