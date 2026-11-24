/**
 * @file social-handle.ts
 * @description The six social networks of the accommodation contact page and
 * the two pure conversions between a stored full URL and the handle the host
 * types after a fixed domain addon (BETA-139).
 *
 * The contact page binds these straight to the shared kit
 * `EditorSocialLinksSection` (HOS-2508, owner decision 11): the section only
 * draws, this module decides how a value is split and recomposed.
 */

import type { AccommodationEditData } from '@/lib/api/types';
import type { ACCOMMODATION_SOCIAL_HTTP_KEYS } from './contact-payload';

/** Per-network config of the accommodation contact page. */
export interface AccommodationSocialField {
    /** `AccommodationEditData` key the field reads and writes (form-local name). */
    readonly field: Extract<
        keyof AccommodationEditData,
        'facebookUrl' | 'instagramUrl' | 'twitterUrl' | 'linkedinUrl' | 'tiktokUrl' | 'youtubeUrl'
    >;
    /**
     * The HTTP / Zod key the field validates under. The DOM id is derived from
     * THIS key, because it is the name `focusFirstInvalidField` is handed when
     * the field fails, and field errors arrive under it (HOS-385).
     */
    readonly schemaKey: (typeof ACCOMMODATION_SOCIAL_HTTP_KEYS)[number];
    /** Fixed domain addon rendered before the handle input (no protocol). */
    readonly domain: string;
    /** i18n key of the visible label. */
    readonly labelKey: string;
    /** `es` fallback label. */
    readonly fallbackLabel: string;
}

/** The six networks, in display order. */
export const ACCOMMODATION_SOCIAL_FIELDS: readonly AccommodationSocialField[] = [
    {
        field: 'facebookUrl',
        schemaKey: 'facebook',
        domain: 'facebook.com/',
        labelKey: 'host.properties.editor.field.facebook',
        fallbackLabel: 'Facebook'
    },
    {
        field: 'instagramUrl',
        schemaKey: 'instagram',
        domain: 'instagram.com/',
        labelKey: 'host.properties.editor.field.instagram',
        fallbackLabel: 'Instagram'
    },
    {
        field: 'twitterUrl',
        schemaKey: 'twitter',
        domain: 'x.com/',
        labelKey: 'host.properties.editor.field.twitter',
        fallbackLabel: 'Twitter / X'
    },
    {
        field: 'linkedinUrl',
        schemaKey: 'linkedin',
        domain: 'linkedin.com/in/',
        labelKey: 'host.properties.editor.field.linkedin',
        fallbackLabel: 'LinkedIn'
    },
    {
        field: 'tiktokUrl',
        schemaKey: 'tiktok',
        domain: 'tiktok.com/@',
        labelKey: 'host.properties.editor.field.tiktok',
        fallbackLabel: 'TikTok'
    },
    {
        field: 'youtubeUrl',
        schemaKey: 'youtube',
        domain: 'youtube.com/@',
        labelKey: 'host.properties.editor.field.youtube',
        fallbackLabel: 'YouTube'
    }
] as const;

/**
 * Strips a stored full URL down to the handle the host typed.
 *
 * An empty value returns `''`. A value that does not match `domain` (another
 * host casing, a legacy URL from another platform, a malformed value) is
 * returned RAW, so nothing is silently hidden: it shows unsplit in the input.
 *
 * @param params - `{ url, domain }`: the stored value and the expected addon.
 * @returns `{ handle }`: the extracted handle, or the raw value.
 */
export function parseSocialHandle({
    url,
    domain
}: {
    readonly url: string | undefined | null;
    readonly domain: string;
}): { readonly handle: string } {
    const raw = (url ?? '').trim();
    if (!raw) return { handle: '' };

    const withoutScheme = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    if (withoutScheme.toLowerCase().startsWith(domain.toLowerCase())) {
        return { handle: withoutScheme.slice(domain.length) };
    }
    return { handle: raw };
}

/**
 * Composes `https://<domain><handle>` from a typed handle.
 *
 * A value that already is a full URL (the raw fallback of
 * {@link parseSocialHandle}) is kept as-is instead of being double-prefixed,
 * and a blank handle yields `''`, never a bare domain.
 *
 * @param params - `{ handle, domain }`: the typed value and the fixed addon.
 * @returns `{ url }`: the composed URL, or `''`.
 */
export function composeSocialUrl({
    handle,
    domain
}: {
    readonly handle: string;
    readonly domain: string;
}): { readonly url: string } {
    const trimmed = handle.trim();
    if (!trimmed) return { url: '' };
    if (/^https?:\/\//i.test(trimmed)) return { url: trimmed };
    return { url: `https://${domain}${trimmed}` };
}
