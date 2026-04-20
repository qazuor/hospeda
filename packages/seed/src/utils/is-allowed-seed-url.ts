/**
 * GAP-078-030 — SSRF allowlist helper for seed-time image downloads.
 *
 * The seed pipeline fetches remote images before re-uploading them to
 * Cloudinary. Without an allowlist, an attacker controlling seed fixtures
 * could point the seeder at arbitrary internal hosts (SSRF). We restrict
 * outbound seed fetches to well-known public image CDNs we already use
 * across the fixtures.
 */

/**
 * Read-only allowlist of hostnames the seed pipeline is permitted to fetch
 * images from. Hostname comparison is case-insensitive.
 *
 * Keep this list intentionally small. Any addition should be justified by a
 * real fixture need and reviewed for SSRF risk (no private/internal hosts,
 * no user-controlled subdomains).
 */
export const ALLOWED_SEED_HOSTNAMES: readonly string[] = Object.freeze([
    'images.unsplash.com',
    'images.pexels.com',
    'res.cloudinary.com'
]);

/**
 * Returns `true` when `url` parses as a valid URL whose hostname is a
 * case-insensitive match for an entry in {@link ALLOWED_SEED_HOSTNAMES}.
 *
 * Returns `false` for:
 * - Strings that fail to parse as a URL (including relative paths).
 * - URLs whose hostname is not on the allowlist.
 * - Non-HTTP(S) protocols (e.g. `file:`, `data:`, `ftp:`) — even if the
 *   hostname happens to be empty or matches by coincidence.
 *
 * @param url - Candidate URL to validate.
 * @returns `true` when the URL is safe to fetch at seed time.
 *
 * @example
 * ```ts
 * isAllowedSeedUrl('https://images.unsplash.com/photo-1');      // true
 * isAllowedSeedUrl('https://IMAGES.PEXELS.COM/photos/1.jpg');  // true
 * isAllowedSeedUrl('http://localhost:3000/secret');             // false
 * isAllowedSeedUrl('file:///etc/passwd');                       // false
 * isAllowedSeedUrl('not a url');                                // false
 * ```
 */
export function isAllowedSeedUrl(url: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_SEED_HOSTNAMES.includes(hostname);
}
