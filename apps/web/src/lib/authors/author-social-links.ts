/**
 * @file author-social-links.ts
 * @description Turns the author payload's optional `socialNetworks` object into
 * the ordered list of links the author page may actually render (HOS-375 §6.7).
 *
 * Extracted from the page rather than left inline because it carries a real
 * decision — which stored values are linkable — and Vitest cannot render
 * `.astro`, so anything left in the template can only be asserted as source
 * text. Same rationale as `breadcrumb-trail.ts` and `profile-page-json-ld.ts`.
 *
 * The icon per network is deliberately NOT decided here: it is a rendering
 * concern that would drag `@repo/icons` into a pure module for no gain.
 */

import { resolveSafeExternalUrl } from '@/lib/safe-external-url';

/**
 * The author's social profiles as the public payload carries them.
 *
 * Structurally identical to `UserAuthorSocialNetworks` in the API client; kept
 * as its own local shape so this module stays independent of the endpoint
 * layer and can be exercised with plain object literals.
 */
export interface AuthorSocialNetworksInput {
    readonly facebook?: string | null;
    readonly instagram?: string | null;
    readonly twitter?: string | null;
    readonly linkedIn?: string | null;
    readonly tiktok?: string | null;
    readonly youtube?: string | null;
}

/** The networks this page can render, in the order it renders them. */
export type AuthorSocialNetworkKey = keyof AuthorSocialNetworksInput;

/** One renderable social profile. */
export interface AuthorSocialLink {
    /** Which network this is — the caller maps it to an icon. */
    readonly key: AuthorSocialNetworkKey;
    /** The network's brand name, used as the link's accessible name. */
    readonly label: string;
    /** An absolute `http(s)` URL, safe to use as an `href`. */
    readonly url: string;
}

/**
 * Display order and brand labels. Brand names are proper nouns and are not
 * translated — `Instagram` reads the same in es/en/pt.
 */
const NETWORKS: readonly { key: AuthorSocialNetworkKey; label: string }[] = [
    { key: 'instagram', label: 'Instagram' },
    { key: 'facebook', label: 'Facebook' },
    { key: 'twitter', label: 'X' },
    { key: 'linkedIn', label: 'LinkedIn' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'tiktok', label: 'TikTok' }
] as const;

/**
 * Resolve the social links an author page may render.
 *
 * Three rules, in order:
 *
 * 1. **No object, no links.** The API omits `socialNetworks` entirely unless the
 *    profile OWNER opted in (§6.7), so the object's presence IS the consent
 *    check — this function never re-derives it and must not be given a
 *    default-empty object to work around a missing opt-in.
 * 2. **Only networks actually filled.** Empty and whitespace-only values are
 *    dropped, so an author who left a field blank gets no dead icon (§8).
 * 3. **Only absolute `http(s)` values**, decided by the repo's one scheme
 *    allow-list, {@link resolveSafeExternalUrl}. The response uses the LENIENT
 *    read shape, which tolerates what the column really holds — bare handles
 *    like `@carmen`, and `m.facebook.com` variants. A bare handle in an `href`
 *    resolves against the current path and ships a broken link, so it is
 *    skipped rather than rendered. This used to be a local `^https?://` regex;
 *    it is the shared helper now so this file cannot drift away from the one
 *    place the rule lives (HOS-592 / F-02).
 *
 * @param input - The payload's `socialNetworks`, or `undefined`/`null` when the
 *   author has not opted in.
 * @returns The renderable links in display order. Empty when there are none.
 *
 * @example
 * resolveAuthorSocialLinks({ socialNetworks: { instagram: 'https://instagram.com/c' } });
 * // [{ key: 'instagram', label: 'Instagram', url: 'https://instagram.com/c' }]
 *
 * @example
 * resolveAuthorSocialLinks({ socialNetworks: { instagram: '@carmen' } });
 * // [] — a handle is not a URL
 */
export function resolveAuthorSocialLinks({
    socialNetworks
}: {
    readonly socialNetworks?: AuthorSocialNetworksInput | null;
}): readonly AuthorSocialLink[] {
    if (!socialNetworks) return [];

    const links: AuthorSocialLink[] = [];

    for (const { key, label } of NETWORKS) {
        const url = resolveSafeExternalUrl(socialNetworks[key]);
        if (url) {
            links.push({ key, label, url });
        }
    }

    return links;
}
