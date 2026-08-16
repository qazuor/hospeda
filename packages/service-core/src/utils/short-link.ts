/**
 * Share / short-link resolution (shared).
 *
 * A "share link" is the short redirect URL a platform hands a user when they tap
 * *Share* — `https://share.google/AbCdEf`, `https://maps.app.goo.gl/xyz`,
 * `https://abnb.me/xyz`. It carries no identifiers of its own: everything a
 * caller needs (a Google `ChIJ` Place ID, an Airbnb room id, a place name) only
 * exists on the canonical URL the short link redirects to.
 *
 * Any consumer that parses identifiers out of a listing URL therefore has to
 * follow the redirect chain FIRST, or it will silently see a URL with nothing in
 * it and degrade — which is exactly how a host's real Google listing ended up
 * fetching no reviews at all (H-132: `share.google/…` reached the reputation
 * adapter unresolved, yielded no Place ID, and the run was still recorded as a
 * success).
 *
 * This module is the single source of truth for that resolution. It was
 * extracted verbatim from `accommodation-import.service.ts` (where it was
 * module-private) so the import pipeline and the external-reputation adapter
 * share ONE hardened implementation instead of two drifting copies.
 *
 * **SSRF safety**: resolution delegates entirely to `safeExternalFetch` — every
 * hop is validated (private-IP checks, per-hop DNS pinning, scheme allow-list,
 * redirect cap). Nothing here widens that policy.
 *
 * @module utils/short-link
 */

import { safeExternalFetch } from '@repo/utils/safe-fetch';

/**
 * Hostnames that are known share / redirect short-link hosts.
 *
 * A URL on one of these hosts CANNOT be matched or parsed by any adapter
 * without first following its redirect chain to the canonical destination URL.
 * Only these hosts trigger an extra fetch; already-canonical URLs (e.g.
 * `booking.com/hotel/...`, `airbnb.com/rooms/...`) are left untouched so the
 * pipeline incurs no extra network round-trip for them.
 *
 * Hosts included:
 * - `share.google`     — Google's current share domain (desktop + mobile "Share"
 *                        button). Confirmed in production listing data.
 * - `maps.app.goo.gl`  — Google Maps modern share link (mobile "Share" button)
 * - `goo.gl`           — Legacy Google short-link (also used for Maps)
 * - `g.co`             — Google short-link variant
 * - `g.page`           — Google Business Profile short-link
 * - `abnb.me`          — Airbnb mobile share link
 */
export const SHORT_LINK_HOSTS: ReadonlySet<string> = new Set([
    'share.google',
    'maps.app.goo.gl',
    'goo.gl',
    'g.co',
    'g.page',
    'abnb.me'
]);

/**
 * Returns `true` when `url` is a known short-link / redirect host that must
 * be resolved to a canonical URL before adapter selection and extraction.
 *
 * Also detects Booking.com share stubs (`/Share-...` path pattern) even though
 * `booking.com` is not itself a short-link host — the Share path redirects to
 * the canonical hotel page.
 *
 * @param input.url - The parsed input URL.
 * @returns `true` when a redirect-following fetch is needed.
 */
export function needsShortLinkResolution(input: { url: URL }): boolean {
    const host = input.url.hostname.toLowerCase();

    // Known pure short-link hostnames
    if (SHORT_LINK_HOSTS.has(host)) {
        return true;
    }

    // Booking.com share stubs: booking.com/Share-XXXXX
    // Exact host match or subdomain of booking.com; ccTLD variants (booking.com.ar
    // etc.) use a bounded regex — prevents booking.com.attacker.com from matching.
    if (
        (host === 'booking.com' ||
            host.endsWith('.booking.com') ||
            /^(?:[a-z0-9-]+\.)*booking\.com\.[a-z]{2,3}$/.test(host)) &&
        input.url.pathname.startsWith('/Share-')
    ) {
        return true;
    }

    return false;
}

/**
 * Resolves a short-link URL to its canonical destination by following the HTTP
 * redirect chain via `safeExternalFetch`.
 *
 * **SSRF safety**: every hop is validated by `safeExternalFetch` —
 * private-IP checks, per-hop DNS pinning, scheme allow-list, and the redirect
 * cap (`maxRedirects`) all apply. No additional wrapping is needed.
 *
 * **Graceful degradation**: any failure (network error, SSRF policy block,
 * redirect loop, timeout) returns the original `inputUrl` unchanged so the
 * caller continues as-is rather than crashing. Callers that need to know whether
 * resolution actually changed anything compare the result to their input.
 *
 * **Body discard (resolve-only)**: we only need the `finalUrl` after the
 * redirect chain, not the terminal page body. An earlier implementation used a
 * tiny `maxBytes` cap, but the cap fires on the TERMINAL (non-redirect)
 * response — yielding `SafeFetchBlocked` and discarding `finalUrl` whenever the
 * canonical page body exceeded the cap (e.g. the large Google Maps place page).
 * That left Google short links unresolved. We use `resolveOnly: true`, which
 * follows the redirects and returns the terminal URL without ever reading its
 * body, so a large terminal page no longer blocks resolution.
 *
 * @param input.url - The short-link URL string to resolve.
 * @param input.timeoutMs - Timeout in milliseconds.
 * @returns The canonical URL string (may equal the input on any failure).
 */
export async function resolveCanonicalUrl(input: {
    url: string;
    timeoutMs: number;
}): Promise<string> {
    const { url, timeoutMs } = input;
    try {
        const result = await safeExternalFetch({
            url,
            timeoutMs,
            maxRedirects: 5,
            resolveOnly: true
        });

        if (result.ok && result.finalUrl !== url) {
            return result.finalUrl;
        }

        // ok: false (SSRF block / redirect-cap / network error) or no redirect
        // happened — fall back to the original input so the caller continues.
        return url;
    } catch {
        // safeExternalFetch is documented to never throw, but guard defensively.
        return url;
    }
}

/**
 * Convenience wrapper: resolves `rawUrl` to its canonical form when — and only
 * when — it is a known share/short link, otherwise returns it untouched.
 *
 * Collapses the `needsShortLinkResolution` + `resolveCanonicalUrl` pair that
 * every caller would otherwise repeat, and guarantees no network round-trip is
 * spent on an already-canonical URL.
 *
 * @param input.rawUrl - The listing URL as stored / supplied by the user.
 * @param input.timeoutMs - Timeout in milliseconds for the redirect-following fetch.
 * @returns The canonical URL string, or `rawUrl` when it is not a short link,
 *   is unparseable, or resolution failed.
 */
export async function canonicalizeIfShortLink(input: {
    rawUrl: string;
    timeoutMs: number;
}): Promise<string> {
    const { rawUrl, timeoutMs } = input;

    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return rawUrl;
    }

    if (!needsShortLinkResolution({ url: parsed })) {
        return rawUrl;
    }

    return resolveCanonicalUrl({ url: rawUrl, timeoutMs });
}
