/**
 * @file listing-videos.ts
 * @description Normalizes the `videos` of a public listing payload into what
 * the shared public video block renders (HOS-1022, HOS-2258).
 *
 * Extracted from the accommodation transform so the venue detail page uses the
 * very same rules instead of a second copy: a video reaches the page only when
 * it is explicitly `APPROVED`.
 */

/** One video as the public block renders it. */
export interface ListingVideo {
    readonly url: string;
    readonly caption?: string;
    readonly description?: string;
}

/**
 * Normalizes a raw `videos` value to `{ url, caption?, description? }` and keeps
 * only the approved entries.
 *
 * HOS-1022: `moderationState` is read here ONLY to filter. A video now reaches
 * the DOM as an `<iframe>`, so an un-approved one must not render. A legacy
 * bare-URL string entry carries no `moderationState` at all (it predates the
 * field), which is treated as "not approved": fail closed, matching the
 * platform's moderation default, rather than assuming old data is safe to
 * publish unreviewed.
 *
 * @param params - The raw payload value (anything is tolerated).
 * @returns The approved videos, in payload order; empty when there are none.
 */
export function normalizeListingVideos({
    raw
}: {
    readonly raw: unknown;
}): readonly ListingVideo[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry): ListingVideo[] => {
        if (!entry || typeof entry !== 'object') return [];
        const video = entry as Record<string, unknown>;
        const url = typeof video.url === 'string' ? video.url : '';
        if (!url || video.moderationState !== 'APPROVED') return [];
        return [
            {
                url,
                ...(typeof video.caption === 'string' ? { caption: video.caption } : {}),
                ...(typeof video.description === 'string' ? { description: video.description } : {})
            }
        ];
    });
}
