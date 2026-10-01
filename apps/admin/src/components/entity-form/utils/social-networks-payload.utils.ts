/**
 * @file social-networks-payload.utils.ts
 * @description Save-payload normalisation for the shared `socialNetworks` JSONB
 * block, used by the admin's generic entity pages.
 */

/**
 * Turns every CLEARED network inside `payload.socialNetworks` into an explicit
 * `null`.
 *
 * `socialNetworks` is a shallow-MERGED JSONB column on every model that owns one
 * (HOS-1262): a key omitted from the patch is PRESERVED, so an emptied text
 * input must travel as `null` to remove the stored link. `SocialNetworkSchema`
 * accepts `null` per key, while `''` fails its `.url()` check — so an empty
 * string can neither clear the value nor pass validation.
 *
 * Only entries of the `socialNetworks` object are touched, and only empty or
 * whitespace-only strings. Networks with a value, other payload keys and a
 * payload without a `socialNetworks` object are returned as they came in.
 *
 * @param params - `{ payload }`, the nested save payload (RO-RO).
 * @returns A new payload; the input is never mutated.
 */
export function nullifyClearedSocialNetworks({
    payload
}: {
    readonly payload: Readonly<Record<string, unknown>>;
}): Record<string, unknown> {
    const social = payload.socialNetworks;
    if (typeof social !== 'object' || social === null || Array.isArray(social)) {
        return { ...payload };
    }

    const normalised: Record<string, unknown> = {};
    for (const [network, value] of Object.entries(social as Record<string, unknown>)) {
        normalised[network] = typeof value === 'string' && value.trim() === '' ? null : value;
    }
    return { ...payload, socialNetworks: normalised };
}
