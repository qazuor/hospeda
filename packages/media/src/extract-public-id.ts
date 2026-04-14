/**
 * Extracts the Cloudinary public ID from a Cloudinary URL.
 *
 * Returns `null` for non-Cloudinary URLs or nullish/empty input.
 *
 * Algorithm:
 * 1. If URL doesn't contain 'res.cloudinary.com', return null
 * 2. Find the '/upload/' segment in the URL path
 * 3. Split remaining path after '/upload/' into segments by '/'
 * 4. Skip transform segments (contain commas, e.g. 'w_400,h_300,c_fill')
 * 5. Skip version segment if present (matches /^v\d+$/)
 * 6. Join remaining segments with '/'
 * 7. Remove file extension from the last segment
 * 8. Return the public ID
 *
 * @param url - Cloudinary URL to parse (accepts null/undefined for convenience)
 * @returns The public ID string, or null if the URL is not a valid Cloudinary URL
 *
 * @example
 * ```ts
 * extractPublicId('https://res.cloudinary.com/hospeda/image/upload/v1234/hospeda/prod/accommodations/abc/featured.jpg')
 * // => 'hospeda/prod/accommodations/abc/featured'
 *
 * extractPublicId('https://images.unsplash.com/photo-abc')
 * // => null
 *
 * extractPublicId(null)
 * // => null
 * ```
 */
export function extractPublicId(url: string | null | undefined): string | null {
    if (!url) {
        return null;
    }

    if (!url.includes('res.cloudinary.com')) {
        return null;
    }

    const uploadMarker = '/upload/';
    const uploadIndex = url.indexOf(uploadMarker);

    if (uploadIndex === -1) {
        return null;
    }

    const afterUpload = url.slice(uploadIndex + uploadMarker.length);
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
