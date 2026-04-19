/**
 * Canonical Cloudinary delivery hostname.
 *
 * Hostname comparison is done strictly via {@link URL.hostname} (exact match)
 * to avoid SSRF/subdomain-spoofing attacks like
 * `https://evil.res.cloudinary.com.attacker.com/...`.
 */
const CLOUDINARY_HOSTNAME = 'res.cloudinary.com';

/**
 * Extracts the Cloudinary public ID from a Cloudinary URL.
 *
 * Returns `null` for non-Cloudinary URLs, malformed URLs, or nullish/empty input.
 *
 * Algorithm:
 * 1. Parse `url` with the WHATWG `URL` constructor; return null on parse error.
 * 2. Require `URL.hostname === 'res.cloudinary.com'` (exact match — no
 *    `includes()`, so subdomain spoofing returns null).
 * 3. Find the `/upload/` segment in the URL path.
 * 4. Split remaining path after `/upload/` into segments by `/`.
 * 5. Skip transform segments (contain commas, e.g. `w_400,h_300,c_fill`).
 * 6. Skip version segment if present (matches `/^v\d+$/`).
 * 7. Join remaining segments with `/`.
 * 8. Remove the file extension from the last segment.
 * 9. Return the public ID.
 *
 * @param url - Cloudinary URL to parse (accepts null/undefined for convenience).
 * @returns The public ID string, or null if the URL is not a valid Cloudinary URL.
 *
 * @example
 * ```ts
 * extractPublicId('https://res.cloudinary.com/hospeda/image/upload/v1234/hospeda/prod/accommodations/abc/featured.jpg')
 * // => 'hospeda/prod/accommodations/abc/featured'
 *
 * extractPublicId('https://images.unsplash.com/photo-abc')
 * // => null
 *
 * extractPublicId('https://evil.res.cloudinary.com.attacker.com/image/upload/v1/x.jpg')
 * // => null  (subdomain spoofing rejected via strict hostname comparison)
 *
 * extractPublicId(null)
 * // => null
 * ```
 */
export function extractPublicId(url: string | null | undefined): string | null {
    if (!url) {
        return null;
    }

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    if (parsed.hostname !== CLOUDINARY_HOSTNAME) {
        return null;
    }

    const uploadMarker = '/upload/';
    const uploadIndex = parsed.pathname.indexOf(uploadMarker);

    if (uploadIndex === -1) {
        return null;
    }

    const afterUpload = parsed.pathname.slice(uploadIndex + uploadMarker.length);
    const segments = afterUpload.split('/');

    const publicSegments = segments.filter((segment) => {
        if (segment.includes(',')) {
            return false;
        }
        if (/^v\d+$/.test(segment)) {
            return false;
        }
        return true;
    });

    if (publicSegments.length === 0) {
        return null;
    }

    const lastSegment = publicSegments[publicSegments.length - 1];
    if (lastSegment === undefined) {
        return null;
    }

    const dotIndex = lastSegment.lastIndexOf('.');
    const lastSegmentWithoutExt = dotIndex !== -1 ? lastSegment.slice(0, dotIndex) : lastSegment;

    publicSegments[publicSegments.length - 1] = lastSegmentWithoutExt;

    return publicSegments.join('/');
}
