/**
 * @file SocialNetworksSection.client.tsx
 * @description Form section for accommodation social network URLs:
 * Facebook, Instagram, Twitter, LinkedIn, TikTok, YouTube. Uses native HTML
 * form elements. Each field shows a fixed, non-editable domain prefix
 * (BETA-139) — the host types only the handle, and the full URL is
 * composed/parsed against `data.<network>Url` on every change. Drawn by the
 * shared kit `EditorSocialLinksSection` (HOS-2488): the domain is the
 * `InputGroup` addon and the platform name a visible label.
 */

import { EditorSocialLinksSection } from '@/components/account/editor-fields/EditorSocialLinksSection';
import type { AccommodationEditData } from '@/lib/api/types';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { ACCOMMODATION_FIELD_PREFIX } from './field-ids';

/** The `AccommodationEditData` fields this section reads and writes. */
type SocialNetworkField =
    | 'facebookUrl'
    | 'instagramUrl'
    | 'twitterUrl'
    | 'linkedinUrl'
    | 'tiktokUrl'
    | 'youtubeUrl';

/** Per-network config driving the DRY field list below. */
interface SocialNetworkFieldConfig {
    /** `AccommodationEditData` key this field reads/writes. */
    readonly field: SocialNetworkField;
    /** Fixed domain prefix rendered before the handle input (no protocol). */
    readonly domain: string;
    /** i18n key for the field label. */
    readonly labelKey: string;
    /** `es` fallback label, also used while `en`/`pt` are untranslated. */
    readonly fallbackLabel: string;
    /**
     * The Zod key this field validates under.
     *
     * The validation schema mirrors the flat HTTP payload and names these by
     * the bare platform (`facebook`), while {@link SocialNetworkField} above is
     * the React state key (`facebookUrl`). `buildFieldId` derives the DOM id
     * from THIS one, because it is the name `focusFirstInvalidField` will be
     * handed when the field fails — so it is not a free-form slug and must not
     * be edited for cosmetic reasons (HOS-385).
     */
    readonly schemaKey: string;
}

const SOCIAL_NETWORK_FIELDS: readonly SocialNetworkFieldConfig[] = [
    {
        field: 'facebookUrl',
        domain: 'facebook.com/',
        labelKey: 'host.properties.editor.field.facebook',
        fallbackLabel: 'Facebook',
        schemaKey: 'facebook'
    },
    {
        field: 'instagramUrl',
        domain: 'instagram.com/',
        labelKey: 'host.properties.editor.field.instagram',
        fallbackLabel: 'Instagram',
        schemaKey: 'instagram'
    },
    {
        field: 'twitterUrl',
        domain: 'x.com/',
        labelKey: 'host.properties.editor.field.twitter',
        fallbackLabel: 'Twitter / X',
        schemaKey: 'twitter'
    },
    {
        field: 'linkedinUrl',
        domain: 'linkedin.com/in/',
        labelKey: 'host.properties.editor.field.linkedin',
        fallbackLabel: 'LinkedIn',
        schemaKey: 'linkedin'
    },
    {
        field: 'tiktokUrl',
        domain: 'tiktok.com/@',
        labelKey: 'host.properties.editor.field.tiktok',
        fallbackLabel: 'TikTok',
        schemaKey: 'tiktok'
    },
    {
        field: 'youtubeUrl',
        domain: 'youtube.com/@',
        labelKey: 'host.properties.editor.field.youtube',
        fallbackLabel: 'YouTube',
        schemaKey: 'youtube'
    }
] as const;

/**
 * Strips a stored full URL down to just the handle typed by the host.
 *
 * Robust by design: an empty/undefined value returns `''`, and a value that
 * doesn't match the expected `domain` (a differently-cased host, a legacy
 * URL from another platform, a malformed value, etc.) falls back to
 * returning the RAW stored value unchanged — nothing is silently hidden or
 * dropped, it's just shown unsplit in the handle input.
 * @param url - The stored full URL value, possibly empty/undefined.
 * @param domain - The expected fixed domain prefix (e.g. `'instagram.com/'`).
 * @returns The extracted handle, or the raw value if the domain doesn't match.
 */
function parseSocialHandle(url: string | undefined | null, domain: string): string {
    const raw = (url ?? '').trim();
    if (!raw) {
        return '';
    }

    const withoutScheme = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    if (withoutScheme.toLowerCase().startsWith(domain.toLowerCase())) {
        return withoutScheme.slice(domain.length);
    }

    return raw;
}

/**
 * Composes a full `https://<domain><handle>` URL from a typed handle.
 *
 * If the typed value already looks like a full URL (starts with
 * `http://`/`https://` — the shape {@link parseSocialHandle} falls back to
 * when a stored value didn't match `domain`), it's saved as-is instead of
 * being double-prefixed, so editing a field that had a non-matching legacy
 * URL never corrupts that URL further.
 * @param handle - The typed handle (or raw fallback value).
 * @param domain - The fixed domain prefix (e.g. `'instagram.com/'`).
 * @returns The composed URL, or `''` if `handle` is blank (never saves a bare domain).
 */
function composeSocialUrl(handle: string, domain: string): string {
    const trimmed = handle.trim();
    if (!trimmed) {
        return '';
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    return `https://${domain}${trimmed}`;
}

/** Props for SocialNetworksSection. */
export interface SocialNetworksSectionProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationEditData;
    readonly errors: Readonly<{
        facebookUrl?: string;
        instagramUrl?: string;
        twitterUrl?: string;
        linkedinUrl?: string;
        tiktokUrl?: string;
        youtubeUrl?: string;
    }>;
    readonly onFieldChange: (field: keyof AccommodationEditData, value: string) => void;
}

/**
 * Social networks form section.
 * Renders a domain-prefixed handle input for each supported social platform.
 *//**
 * Social networks of one accommodation, on the kit.
 *
 * @param props - See {@link SocialNetworksSectionProps}.
 * @returns The shared social links section.
 */
export function SocialNetworksSection({
    locale,
    data,
    errors,
    onFieldChange
}: SocialNetworksSectionProps) {
    const t = createT(locale);

    return (
        <EditorSocialLinksSection
            locale={locale}
            helpId="section:accommodation.contacto"
            links={SOCIAL_NETWORK_FIELDS.map((config) => ({
                id: buildFieldId({ prefix: ACCOMMODATION_FIELD_PREFIX, name: config.schemaKey }),
                label: t(config.labelKey, config.fallbackLabel),
                prefix: config.domain,
                value: parseSocialHandle(data[config.field], config.domain),
                onChange: (value: string) =>
                    onFieldChange(config.field, composeSocialUrl(value, config.domain)),
                error: errors[config.field]
            }))}
        />
    );
}
