/**
 * @file SocialNetworksSection.client.tsx
 * @description Form section for accommodation social network URLs:
 * Facebook, Instagram, Twitter, LinkedIn, TikTok, YouTube. Uses native HTML
 * form elements. Each field shows a fixed, non-editable domain prefix
 * (BETA-139) — the host types only the handle, and the full URL is
 * composed/parsed against `data.<network>Url` on every change.
 */

import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './SocialNetworksSection.module.css';

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
    /** Placeholder handle shown in the (empty) input. */
    readonly handlePlaceholder: string;
    /** Slug used to build stable DOM ids (`acc-<slug>`). */
    readonly idSlug: string;
}

const SOCIAL_NETWORK_FIELDS: readonly SocialNetworkFieldConfig[] = [
    {
        field: 'facebookUrl',
        domain: 'facebook.com/',
        labelKey: 'host.properties.editor.field.facebook',
        fallbackLabel: 'Facebook',
        handlePlaceholder: 'tu-pagina',
        idSlug: 'facebook'
    },
    {
        field: 'instagramUrl',
        domain: 'instagram.com/',
        labelKey: 'host.properties.editor.field.instagram',
        fallbackLabel: 'Instagram',
        handlePlaceholder: 'tu-perfil',
        idSlug: 'instagram'
    },
    {
        field: 'twitterUrl',
        domain: 'x.com/',
        labelKey: 'host.properties.editor.field.twitter',
        fallbackLabel: 'Twitter / X',
        handlePlaceholder: 'tu-usuario',
        idSlug: 'twitter'
    },
    {
        field: 'linkedinUrl',
        domain: 'linkedin.com/in/',
        labelKey: 'host.properties.editor.field.linkedin',
        fallbackLabel: 'LinkedIn',
        handlePlaceholder: 'tu-perfil',
        idSlug: 'linkedin'
    },
    {
        field: 'tiktokUrl',
        domain: 'tiktok.com/@',
        labelKey: 'host.properties.editor.field.tiktok',
        fallbackLabel: 'TikTok',
        handlePlaceholder: 'tu-usuario',
        idSlug: 'tiktok'
    },
    {
        field: 'youtubeUrl',
        domain: 'youtube.com/@',
        labelKey: 'host.properties.editor.field.youtube',
        fallbackLabel: 'YouTube',
        handlePlaceholder: 'tu-canal',
        idSlug: 'youtube'
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

/** Props for the internal per-network handle input. */
interface SocialUrlFieldProps {
    readonly id: string;
    readonly label: string;
    readonly domain: string;
    readonly handle: string;
    readonly placeholder: string;
    readonly error?: string;
    readonly onHandleChange: (value: string) => void;
}

/**
 * One social-network field: label, fixed domain prefix, and handle input.
 * Collapses the 6 structurally-identical fields in {@link SocialNetworksSection}
 * into a single reusable component.
 */
function SocialUrlField({
    id,
    label,
    domain,
    handle,
    placeholder,
    error,
    onHandleChange
}: SocialUrlFieldProps) {
    const prefixId = `${id}-prefix`;
    const errorId = `${id}-error`;
    const describedBy = [prefixId, error ? errorId : undefined].filter(Boolean).join(' ');

    return (
        <div className={styles.field}>
            <label
                htmlFor={id}
                className={styles.fieldLabel}
            >
                {label}
            </label>
            <div className={styles.urlInputGroup}>
                <span
                    id={prefixId}
                    className={styles.urlPrefix}
                >
                    {domain}
                </span>
                <input
                    id={id}
                    type="text"
                    className={`${styles.fieldInput} ${styles.urlHandleInput}`}
                    value={handle}
                    onChange={(e) => onHandleChange(e.target.value)}
                    placeholder={placeholder}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy}
                />
            </div>
            {error && (
                <span
                    id={errorId}
                    className={styles.fieldError}
                    role="alert"
                >
                    {error}
                </span>
            )}
        </div>
    );
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
 */
export function SocialNetworksSection({
    locale,
    data,
    errors,
    onFieldChange
}: SocialNetworksSectionProps) {
    const { t } = createTranslations(locale);

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.socialNetworks', 'Redes sociales')}
            </legend>

            {SOCIAL_NETWORK_FIELDS.map((config) => (
                <SocialUrlField
                    key={config.field}
                    id={`acc-${config.idSlug}`}
                    label={t(config.labelKey, config.fallbackLabel)}
                    domain={config.domain}
                    handle={parseSocialHandle(data[config.field], config.domain)}
                    placeholder={config.handlePlaceholder}
                    error={errors[config.field]}
                    onHandleChange={(value) =>
                        onFieldChange(config.field, composeSocialUrl(value, config.domain))
                    }
                />
            ))}
        </fieldset>
    );
}
