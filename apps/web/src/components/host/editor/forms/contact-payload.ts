/**
 * @file contact-payload.ts
 * @description Pure payload helper for the accommodation contact page.
 */

/** The HTTP keys of the six social networks (what the API validates and stores). */
export const ACCOMMODATION_SOCIAL_HTTP_KEYS = [
    'facebook',
    'instagram',
    'twitter',
    'linkedin',
    'tiktok',
    'youtube'
] as const;

/**
 * Turns a CLEARED social network into an explicit `null` in a PATCH payload.
 *
 * `accommodations.socialNetworks` is a shallow-MERGED JSONB column (SPEC-229,
 * HOS-1262): a key left out of the patch is PRESERVED, so an emptied input must
 * travel as `null` to clear the stored value. The flat HTTP schema accepts
 * `null` on every social key, while `''` fails its `.url()` check, so an empty
 * string is not an option either.
 *
 * Only keys already present in the diff are touched: an untouched network never
 * enters the payload, and a network with a value is passed through unchanged.
 *
 * @param params - `{ payload }` — the changed-fields-only diff (RO-RO).
 * @returns Only the overrides to merge over the diff (empty when nothing was cleared).
 */
export function nullifyClearedSocials({
    payload
}: {
    readonly payload: Readonly<Record<string, unknown>>;
}): Record<string, unknown> {
    const overrides: Record<string, unknown> = {};
    for (const key of ACCOMMODATION_SOCIAL_HTTP_KEYS) {
        if (!(key in payload)) continue;
        const value = payload[key];
        const trimmed = typeof value === 'string' ? value.trim() : value;
        if (trimmed === '' || trimmed === undefined || trimmed === null) {
            overrides[key] = null;
        }
    }
    return overrides;
}
