/**
 * @file TranslationPanel.client.tsx
 * @description Host-facing translation status + trigger panel (SPEC-212).
 *
 * Shows, per translatable field (name, summary, description, richDescription),
 * which of the three supported locales (es, en, pt) already have content and
 * which are missing. A single "Generate missing translations" button POSTs to
 * the protected AI translate endpoint.
 *
 * Design decisions:
 * - Props carry `AccommodationTranslationData` (a SEPARATE type from
 *   `AccommodationEditData`) so translation data never enters the PATCH diff.
 * - Translations are generated OUT of the locale the CONTENT is authored in —
 *   always Spanish, see `CONTENT_SOURCE_LOCALE` — and into the missing ones. The
 *   `locale` prop drives the panel's own copy, nothing else.
 * - The rules deciding what is missing / attempted / failed live in
 *   `translation-status.ts`; this file is the markup around their answers.
 *
 * HOS-317 — the endpoint answers with one result per (field × locale), so the
 * run is reported per FIELD instead of behind one global spinner: each row shows
 * whether it is in flight, translated, or failed and in which locales. The page
 * only auto-reloads on a fully clean run; a run with any failure keeps its
 * detail on screen behind an explicit refresh, because reloading is what used to
 * wipe the evidence.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccommodationTranslationData, TranslatableFieldStatus } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './TranslationPanel.module.css';
import type { FieldOutcome, GenerationOutcomes, TranslationResultItem } from './translation-status';
import {
    anyTranslationPersisted,
    fieldsWithMissingTranslations,
    hasSourceContent,
    pendingOutcomes,
    SUPPORTED_LOCALES,
    summarizeOutcomes
} from './translation-status';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for TranslationPanel. */
export interface TranslationPanelProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly translations: AccommodationTranslationData;
}

/** Human-readable label for each locale. */
const LOCALE_LABELS: Record<SupportedLocale, string> = {
    es: 'ES',
    en: 'EN',
    pt: 'PT'
};

/**
 * The locale the accommodation's content is authored in — always Spanish.
 *
 * NOT the page locale, which is what this panel used to send. The editor form is
 * populated from the PLAIN columns (`transformAccommodationEdit` reads `item.name`
 * / `item.summary` / `item.description`, never the i18n ones), so a host editing
 * with the interface in English is still editing the Spanish text. Sending the
 * page locale claimed otherwise, and the backend believed it: `loadTranslatableFields`
 * looked for the source in `nameI18n.en`, found nothing, and translated nothing —
 * so opening the editor in EN or PT showed four "no content to translate" rows and
 * no button at all, on an accommodation whose Spanish text was right there.
 *
 * When the editor can genuinely author content in another locale, this becomes a
 * real choice and belongs in the UI. Until then it is a fact about the data.
 */
const CONTENT_SOURCE_LOCALE: SupportedLocale = 'es';

/** Shape of the translate endpoint's `data` payload. */
interface TranslateResponse {
    readonly translations?: readonly TranslationResultItem[];
}

// ---------------------------------------------------------------------------
// Sub-component: FieldRow
// ---------------------------------------------------------------------------

interface FieldRowProps {
    readonly status: TranslatableFieldStatus;
    readonly sourceLocale: SupportedLocale;
    readonly fieldLabel: string;
    readonly outcome?: FieldOutcome;
    readonly t: (key: string, fallback?: string, params?: Record<string, unknown>) => string;
}

/**
 * Renders a single field card: locale presence badges, plus this field's state
 * during and after a generation run.
 */
function FieldRow({ status, sourceLocale, fieldLabel, outcome, t }: FieldRowProps) {
    const sourced = hasSourceContent({ status, sourceLocale });

    return (
        <div className={styles.fieldCard}>
            <div className={styles.fieldName}>{fieldLabel}</div>
            <div className={styles.locales}>
                {SUPPORTED_LOCALES.map((locale) => {
                    const isSource = locale === sourceLocale;
                    const hasContent = Boolean(status.locales[locale]);

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
            <FieldNote
                sourced={sourced}
                outcome={outcome}
                t={t}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Sub-component: FieldNote
// ---------------------------------------------------------------------------

interface FieldNoteProps {
    readonly sourced: boolean;
    readonly outcome?: FieldOutcome;
    readonly t: (key: string, fallback?: string, params?: Record<string, unknown>) => string;
}

/**
 * The per-field line under the badges: run state while a generation is in
 * flight or just finished, otherwise an explanation for a field that has no
 * source text to translate from.
 */
function FieldNote({ sourced, outcome, t }: FieldNoteProps) {
    if (outcome) {
        if (outcome.status === 'pending') {
            return (
                <p className={styles.fieldNote}>
                    {t('host.properties.editor.translation.fieldPending', 'Generando...')}
                </p>
            );
        }
        if (outcome.status === 'translated') {
            return (
                <p className={`${styles.fieldNote} ${styles.fieldNoteSuccess}`}>
                    {t('host.properties.editor.translation.fieldTranslated', 'Traducido')}
                </p>
            );
        }
        if (outcome.status === 'failed') {
            // `failedLocales` can be empty even here: a locale the client cannot
            // name is dropped from the list but never cancels the failure itself.
            // Naming no locale beats rendering "... a " with nothing after it.
            const named = outcome.failedLocales.map((locale) => LOCALE_LABELS[locale]).join(', ');
            return (
                <p className={`${styles.fieldNote} ${styles.fieldNoteError}`}>
                    {named
                        ? t(
                              'host.properties.editor.translation.fieldFailed',
                              'No se pudo traducir a {{locales}}',
                              { locales: named }
                          )
                        : t(
                              'host.properties.editor.translation.fieldFailedUnknown',
                              'No se pudo traducir este campo'
                          )}
                </p>
            );
        }
        return (
            <p className={styles.fieldNote}>
                {t('host.properties.editor.translation.fieldUntouched', 'Sin cambios')}
            </p>
        );
    }

    if (!sourced) {
        return (
            <p className={styles.fieldNote}>
                {t(
                    'host.properties.editor.translation.fieldNoSource',
                    'Sin contenido para traducir'
                )}
            </p>
        );
    }

    return null;
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
 * - `translations` — per-field status (from `transformAccommodationTranslations`)
 */
export function TranslationPanel({ locale, accommodationId, translations }: TranslationPanelProps) {
    const { t } = createTranslations(locale);

    const [isGenerating, setIsGenerating] = useState(false);
    const [outcomes, setOutcomes] = useState<GenerationOutcomes | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    /**
     * A clean run schedules a reload. Until it fires, the panel is still showing
     * stale content, so the generate button must stay out of action — otherwise
     * the host can start a second 90-second run that the reload aborts mid-flight,
     * after the provider calls were already paid for.
     */
    const [isReloading, setIsReloading] = useState(false);
    /**
     * Whether ANY run in this page's lifetime wrote something.
     *
     * Sticky on purpose. Offering the refresh is about whether reloading would
     * show the host anything new, which stays true once a run has written — and a
     * per-run flag would take the offer away on a subsequent failed retry, exactly
     * when the host most wants to reach what the earlier run did manage to save.
     */
    const [hasPersistedAnything, setHasPersistedAnything] = useState(false);

    /** Live handle on the pending reload, so unmount can cancel it. */
    const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            // `apps/web` runs Astro's ClientRouter, so this island can unmount on
            // a soft navigation inside the 1.5s window. Without this the timer
            // fires on whatever page the host navigated to and hard-reloads it.
            if (reloadTimer.current !== null) clearTimeout(reloadTimer.current);
        },
        []
    );

    const pendingFields = fieldsWithMissingTranslations({
        translations,
        sourceLocale: CONTENT_SOURCE_LOCALE
    });
    const canGenerate = pendingFields.length > 0;

    const handleGenerate = useCallback(async () => {
        const requested = fieldsWithMissingTranslations({
            translations,
            sourceLocale: CONTENT_SOURCE_LOCALE
        });

        setIsGenerating(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        setOutcomes(pendingOutcomes(requested));

        try {
            const { apiClient } = await import('@/lib/api/client');
            const result = await apiClient.postProtected<TranslateResponse>({
                path: '/api/v1/protected/ai/translate',
                body: {
                    entityType: 'accommodation',
                    entityId: accommodationId,
                    sourceLocale: CONTENT_SOURCE_LOCALE
                },
                // BETA-135: the backend translates every field x locale
                // sequentially (up to ~8 LLM calls), which routinely exceeds
                // the client's default 10s timeout. Override it for this call
                // only — every other request keeps the 10s default.
                timeoutMs: 90_000
            });

            if (!result.ok) {
                setOutcomes(null);
                setErrorMessage(
                    result.error.message ||
                        t(
                            'host.properties.editor.translation.errorGeneric',
                            'No se pudieron generar las traducciones. Intentá de nuevo.'
                        )
                );
                return;
            }

            const results = result.data?.translations ?? [];
            const runOutcomes = summarizeOutcomes({ requested, results });
            setOutcomes(runOutcomes);

            if (results.length === 0) {
                // The backend skips (field, locale) pairs that already have
                // content, so an empty result set means it attempted nothing —
                // reporting success here would claim work that never happened.
                setErrorMessage(
                    t(
                        'host.properties.editor.translation.nothingGenerated',
                        'No había traducciones pendientes para generar.'
                    )
                );
                return;
            }

            const persisted = anyTranslationPersisted({ results, requested });
            if (persisted) setHasPersistedAnything(true);

            if (!persisted) {
                // Nothing was written. A reload would replay the same screen and
                // take the per-field failure detail down with it.
                setErrorMessage(
                    t(
                        'host.properties.editor.translation.allFailed',
                        'No se pudo generar ninguna traducción. Revisá el detalle por campo e intentá de nuevo.'
                    )
                );
                return;
            }

            const anyFailed = Object.values(runOutcomes).some(
                (outcome) => outcome.status === 'failed'
            );

            if (anyFailed) {
                // Partial success: some content WAS written, so a refresh is
                // worth offering — but not automatically, or the host never gets
                // to read which fields did not make it.
                setErrorMessage(
                    t(
                        'host.properties.editor.translation.partialFailure',
                        'Algunas traducciones no se generaron. Revisá el detalle por campo.'
                    )
                );
                return;
            }

            setSuccessMessage(
                t(
                    'host.properties.editor.translation.successMessage',
                    'Traducciones generadas. Recargando...'
                )
            );
            // Keep the panel out of action until the reload lands: `isGenerating`
            // is cleared in the `finally` below, which runs BEFORE this fires.
            setIsReloading(true);
            // Short delay so the host can read the success message before reload
            reloadTimer.current = setTimeout(() => {
                if (typeof window !== 'undefined') {
                    window.location.reload();
                }
            }, 1500);
        } catch {
            setOutcomes(null);
            setErrorMessage(
                t(
                    'host.properties.editor.translation.errorNetwork',
                    'Error de conexión al intentar generar las traducciones.'
                )
            );
        } finally {
            setIsGenerating(false);
        }
    }, [accommodationId, t, translations]);

    const handleRefresh = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    }, []);

    /**
     * Whether reloading would show the host anything they cannot see yet.
     *
     * Reads the sticky flag, not the current run's outcomes: a retry that fails
     * outright does not undo what an earlier run wrote, and taking the offer away
     * there strands the host with no route to it. Hidden while a reload is already
     * on its way, so "Recargando..." and a manual refresh button never coexist.
     */
    const canRefresh = hasPersistedAnything && !isGenerating && !isReloading;

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
                    status={translations.name}
                    sourceLocale={CONTENT_SOURCE_LOCALE}
                    fieldLabel={t('host.properties.editor.field.name', 'Nombre')}
                    outcome={outcomes?.name}
                    t={t}
                />
                <FieldRow
                    status={translations.summary}
                    sourceLocale={CONTENT_SOURCE_LOCALE}
                    fieldLabel={t('host.properties.editor.field.summary', 'Resumen')}
                    outcome={outcomes?.summary}
                    t={t}
                />
                <FieldRow
                    status={translations.description}
                    sourceLocale={CONTENT_SOURCE_LOCALE}
                    fieldLabel={t('host.properties.editor.field.description', 'Descripción')}
                    outcome={outcomes?.description}
                    t={t}
                />
                {/* BETA-199: absent when the owner's plan has no rich description.
                    The API omits the premium pair entirely in that case, and a row
                    that can never fill in is what kept the generate button alive
                    forever. */}
                {translations.richDescription !== null && (
                    <FieldRow
                        status={translations.richDescription}
                        sourceLocale={CONTENT_SOURCE_LOCALE}
                        fieldLabel={t(
                            'host.properties.editor.translation.fieldRichDescription',
                            'Descripción enriquecida'
                        )}
                        outcome={outcomes?.richDescription}
                        t={t}
                    />
                )}
            </div>

            {canGenerate && (
                <button
                    type="button"
                    className={styles.generateButton}
                    onClick={handleGenerate}
                    disabled={isGenerating || isReloading}
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

            {canRefresh && (
                <button
                    type="button"
                    className={styles.refreshButton}
                    onClick={handleRefresh}
                >
                    {t('host.properties.editor.translation.refresh', 'Actualizar la página')}
                </button>
            )}

            {successMessage && <output className={styles.feedbackSuccess}>{successMessage}</output>}
        </fieldset>
    );
}
