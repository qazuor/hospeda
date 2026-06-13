/**
 * @file TranslationPanel.client.tsx
 * @description Host-facing translation status + trigger panel (SPEC-212).
 *
 * Shows, per translatable field (name, summary, description, richDescription),
 * which of the three supported locales (es, en, pt) already have content and
 * which are missing. A single "Generate missing translations" button POSTs to
 * the protected AI translate endpoint and reloads the page on success so the
 * newly generated content is visible.
 *
 * Design decisions:
 * - Props carry `AccommodationTranslationData` (a SEPARATE type from
 *   `AccommodationEditData`) so translation data never enters the PATCH diff.
 * - The `sourceLocale` is the page locale — translations are generated OUT of
 *   that locale into the other missing ones (the backend handles the logic).
 * - On success the page is reloaded via `window.location.reload()` after a
 *   short delay so the host sees the new translations immediately.
 */

import type { AccommodationTranslationData, I18nFieldValues } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useState } from 'react';
import styles from './TranslationPanel.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for TranslationPanel. */
export interface TranslationPanelProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly translations: AccommodationTranslationData;
}

/** The three supported locales. */
const SUPPORTED_LOCALES = ['es', 'en', 'pt'] as const;

/** Human-readable label for each locale. */
const LOCALE_LABELS: Record<SupportedLocale, string> = {
    es: 'ES',
    en: 'EN',
    pt: 'PT'
};

/** The four translatable fields in display order. */
const TRANSLATABLE_FIELDS = ['name', 'summary', 'description', 'richDescription'] as const;

type TranslatableField = (typeof TRANSLATABLE_FIELDS)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if any translatable field has at least one missing locale
 * (other than the source locale).
 */
function hasMissingTranslations({
    translations,
    sourceLocale
}: {
    readonly translations: AccommodationTranslationData;
    readonly sourceLocale: SupportedLocale;
}): boolean {
    for (const field of TRANSLATABLE_FIELDS) {
        const values: I18nFieldValues = translations[field];
        for (const locale of SUPPORTED_LOCALES) {
            if (locale === sourceLocale) continue;
            if (!values[locale]) return true;
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// Sub-component: FieldRow
// ---------------------------------------------------------------------------

interface FieldRowProps {
    readonly fieldKey: TranslatableField;
    readonly values: I18nFieldValues;
    readonly sourceLocale: SupportedLocale;
    readonly fieldLabel: string;
}

/**
 * Renders a single field card showing locale presence/absence badges.
 */
function FieldRow({ fieldKey: _fieldKey, values, sourceLocale, fieldLabel }: FieldRowProps) {
    return (
        <div className={styles.fieldCard}>
            <div className={styles.fieldName}>{fieldLabel}</div>
            <div className={styles.locales}>
                {SUPPORTED_LOCALES.map((locale) => {
                    const isSource = locale === sourceLocale;
                    const hasContent = Boolean(values[locale]);

                    let badgeClass = styles.localeBadgeMissing;
                    if (isSource) {
                        badgeClass = styles.localeBadgeSource;
                    } else if (hasContent) {
                        badgeClass = styles.localeBadgePresent;
                    }

                    return (
                        <span
                            key={locale}
                            className={`${styles.localeBadge} ${badgeClass}`}
                        >
                            {isSource ? (
                                /* Source locale: pencil icon */
                                <svg
                                    className={styles.localeIcon}
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    aria-hidden="true"
                                    focusable="false"
                                >
                                    <path
                                        d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.609Z"
                                        fill="currentColor"
                                    />
                                </svg>
                            ) : hasContent ? (
                                /* Present: check icon */
                                <svg
                                    className={styles.localeIcon}
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    aria-hidden="true"
                                    focusable="false"
                                >
                                    <path
                                        d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
                                        fill="currentColor"
                                    />
                                </svg>
                            ) : (
                                /* Missing: dash icon */
                                <svg
                                    className={styles.localeIcon}
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    aria-hidden="true"
                                    focusable="false"
                                >
                                    <path
                                        d="M2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Z"
                                        fill="currentColor"
                                    />
                                </svg>
                            )}
                            {LOCALE_LABELS[locale]}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * TranslationPanel
 *
 * Displays translation status for all translatable fields and provides a
 * single button to generate missing translations via the protected AI endpoint.
 *
 * Props:
 * - `locale` — the page locale (source locale for AI generation)
 * - `accommodationId` — used in the POST body
 * - `translations` — per-field i18n values (from `transformAccommodationTranslations`)
 */
export function TranslationPanel({ locale, accommodationId, translations }: TranslationPanelProps) {
    const { t } = createTranslations(locale);

    const [isGenerating, setIsGenerating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const canGenerate = hasMissingTranslations({ translations, sourceLocale: locale });

    const handleGenerate = useCallback(async () => {
        setIsGenerating(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const { apiClient } = await import('@/lib/api/client');
            const result = await apiClient.postProtected({
                path: '/api/v1/protected/ai/translate',
                body: {
                    entityType: 'accommodation',
                    entityId: accommodationId,
                    sourceLocale: locale
                }
            });

            if (result.ok) {
                setSuccessMessage(
                    t(
                        'host.properties.editor.translation.successMessage',
                        'Traducciones generadas. Recargando...'
                    )
                );
                // Short delay so the host can read the success message before reload
                setTimeout(() => {
                    if (typeof window !== 'undefined') {
                        window.location.reload();
                    }
                }, 1500);
            } else {
                setErrorMessage(
                    result.error.message ||
                        t(
                            'host.properties.editor.translation.errorGeneric',
                            'No se pudieron generar las traducciones. Intentá de nuevo.'
                        )
                );
            }
        } catch {
            setErrorMessage(
                t(
                    'host.properties.editor.translation.errorNetwork',
                    'Error de conexión al intentar generar las traducciones.'
                )
            );
        } finally {
            setIsGenerating(false);
        }
    }, [accommodationId, locale, t]);

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.translation.sectionTitle', 'Traducciones')}
            </legend>

            <p className={styles.sectionDescription}>
                {t(
                    'host.properties.editor.translation.sectionDescription',
                    'Estado de traducción de los campos principales de tu propiedad. Las traducciones faltantes se generan automáticamente con IA a partir del idioma que estás usando.'
                )}
            </p>

            <div className={styles.grid}>
                <FieldRow
                    fieldKey="name"
                    values={translations.name}
                    sourceLocale={locale}
                    fieldLabel={t('host.properties.editor.field.name', 'Nombre')}
                />
                <FieldRow
                    fieldKey="summary"
                    values={translations.summary}
                    sourceLocale={locale}
                    fieldLabel={t('host.properties.editor.field.summary', 'Resumen')}
                />
                <FieldRow
                    fieldKey="description"
                    values={translations.description}
                    sourceLocale={locale}
                    fieldLabel={t('host.properties.editor.field.description', 'Descripción')}
                />
                <FieldRow
                    fieldKey="richDescription"
                    values={translations.richDescription}
                    sourceLocale={locale}
                    fieldLabel={t(
                        'host.properties.editor.translation.fieldRichDescription',
                        'Descripción enriquecida'
                    )}
                />
            </div>

            {canGenerate && (
                <button
                    type="button"
                    className={styles.generateButton}
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    aria-busy={isGenerating}
                >
                    {isGenerating
                        ? t(
                              'host.properties.editor.translation.generating',
                              'Generando traducciones...'
                          )
                        : t(
                              'host.properties.editor.translation.generateButton',
                              'Generar traducciones faltantes'
                          )}
                </button>
            )}

            {errorMessage && (
                <div
                    className={styles.feedbackError}
                    role="alert"
                >
                    {errorMessage}
                </div>
            )}

            {successMessage && <output className={styles.feedbackSuccess}>{successMessage}</output>}
        </fieldset>
    );
}
