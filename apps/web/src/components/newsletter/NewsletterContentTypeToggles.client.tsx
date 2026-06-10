/**
 * @file NewsletterContentTypeToggles.client.tsx
 * @description Per-content-type opt-in toggles rendered on the account
 * preferences page when the subscriber is ACTIVE.
 *
 * Each checkbox is wired to PATCH /api/v1/protected/newsletter/preferences
 * with a partial body containing ONLY the flipped key — the service merges
 * it onto the stored JSONB so the other keys retain their existing value.
 *
 * The component owns local state that is seeded by the parent's most recent
 * preferences snapshot (`initialPreferences`). On a failed PATCH the
 * checkbox snaps back to its previous value and a polite aria-live message
 * announces the error.
 *
 * Bounced / complained subscribers never reach this component — the parent
 * renders the terminal note instead.
 */

import { type ApiErrorShape, translateApiError } from '@/lib/api-errors';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useId, useState } from 'react';
import styles from './NewsletterContentTypeToggles.module.css';

/**
 * Wire keys for `newsletter_subscribers.preferences`. KEEP IN SYNC with
 * `NewsletterContentTypeEnum` in `@repo/schemas`.
 */
const CONTENT_TYPE_KEYS = ['offers', 'events', 'guides', 'productNews'] as const;
type ContentTypeKey = (typeof CONTENT_TYPE_KEYS)[number];
type Preferences = Record<ContentTypeKey, boolean>;

export interface NewsletterContentTypeTogglesProps {
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
    /** Initial preference snapshot from the parent's /status response. */
    readonly initialPreferences: Preferences;
    /** Disabled flag — propagated from the parent when a sibling action is in flight. */
    readonly disabled?: boolean;
}

function joinApi(apiUrl: string, path: string): string {
    return `${apiUrl.replace(/\/$/, '')}${path}`;
}

async function readApiError(res: Response): Promise<ApiErrorShape | null> {
    try {
        const body = (await res.json()) as { readonly error?: ApiErrorShape };
        return body?.error ?? null;
    } catch {
        return null;
    }
}

export function NewsletterContentTypeToggles({
    locale,
    apiUrl,
    initialPreferences,
    disabled = false
}: NewsletterContentTypeTogglesProps) {
    const { t } = createTranslations(locale);
    const liveRegionId = useId();

    const [preferences, setPreferences] = useState<Preferences>(initialPreferences);
    const [inFlightKey, setInFlightKey] = useState<ContentTypeKey | null>(null);
    const [statusText, setStatusText] = useState<string>('');

    const updatePreference = useCallback(
        async (key: ContentTypeKey, next: boolean): Promise<void> => {
            // Optimistic update so the checkbox feels responsive; we revert on
            // a non-2xx and announce the error via the aria-live region.
            const previous = preferences[key];
            setPreferences((p) => ({ ...p, [key]: next }));
            setInFlightKey(key);
            setStatusText('');

            try {
                const res = await fetch(
                    joinApi(apiUrl, '/api/v1/protected/newsletter/preferences'),
                    {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ [key]: next })
                    }
                );
                if (!res.ok) {
                    setPreferences((p) => ({ ...p, [key]: previous }));
                    const apiError = await readApiError(res);
                    setStatusText(
                        translateApiError({
                            error: apiError,
                            locale,
                            fallback: t(
                                'account.newsletter.preferences.error',
                                'No pudimos guardar tu preferencia. Probá de nuevo.'
                            )
                        })
                    );
                    return;
                }
                setStatusText(t('account.newsletter.preferences.saved', 'Preferencia guardada.'));
            } catch {
                setPreferences((p) => ({ ...p, [key]: previous }));
                setStatusText(
                    t(
                        'account.newsletter.preferences.error',
                        'No pudimos guardar tu preferencia. Probá de nuevo.'
                    )
                );
            } finally {
                setInFlightKey((current) => (current === key ? null : current));
            }
        },
        [apiUrl, locale, preferences, t]
    );

    const labels: Record<ContentTypeKey, { label: string; description: string }> = {
        offers: {
            label: t('account.newsletter.preferences.offers', 'Ofertas'),
            description: t(
                'account.newsletter.preferences.offersDesc',
                'Promociones y descuentos por tiempo limitado.'
            )
        },
        events: {
            label: t('account.newsletter.preferences.events', 'Eventos'),
            description: t(
                'account.newsletter.preferences.eventsDesc',
                'Festivales, agenda cultural y eventos próximos.'
            )
        },
        guides: {
            label: t('account.newsletter.preferences.guides', 'Guías'),
            description: t(
                'account.newsletter.preferences.guidesDesc',
                'Guías editoriales e itinerarios curados.'
            )
        },
        productNews: {
            label: t('account.newsletter.preferences.productNews', 'Novedades del producto'),
            description: t(
                'account.newsletter.preferences.productNewsDesc',
                'Nuevas funcionalidades y novedades de la plataforma.'
            )
        }
    };

    return (
        <fieldset
            className={styles.fieldset}
            disabled={disabled}
        >
            <legend className={styles.legend}>
                {t('account.newsletter.preferences.title', 'Qué querés recibir')}
            </legend>

            <p
                id={liveRegionId}
                className={styles.liveRegion}
                aria-live="polite"
                aria-atomic="true"
            >
                {statusText}
            </p>

            <ul className={styles.list}>
                {CONTENT_TYPE_KEYS.map((key) => {
                    const checked = preferences[key];
                    const busy = inFlightKey === key;
                    return (
                        <li
                            key={key}
                            className={styles.item}
                        >
                            <label className={styles.label}>
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(event) => {
                                        void updatePreference(key, event.currentTarget.checked);
                                    }}
                                    disabled={disabled || busy}
                                    aria-describedby={liveRegionId}
                                    className={styles.checkbox}
                                />
                                <span className={styles.labelText}>
                                    <span className={styles.labelTitle}>{labels[key].label}</span>
                                    <span className={styles.labelDescription}>
                                        {labels[key].description}
                                    </span>
                                </span>
                            </label>
                        </li>
                    );
                })}
            </ul>
        </fieldset>
    );
}
