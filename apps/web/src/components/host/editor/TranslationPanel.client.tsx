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
 * whether it is in flight, translated, or failed and in which locales.
 *
 * The page NEVER reloads on its own. This panel is a `<fieldset>` inside the
 * editor's `<form>`, and `apps/web` has no `beforeunload` guard anywhere, so an
 * automatic reload silently discarded whatever the host had typed and not yet
 * saved. A run that wrote something offers an explicit refresh instead, and folds
 * its own results into what the rows show — the prop is frozen at SSR, so without
 * that the panel would keep displaying the state the page was built with.
 *
 * The refresh button still reloads, and still costs an unsaved draft. Reducing
 * that from automatic to one deliberate click is where this change stops; warning
 * the host before it happens needs the editor's dirty state and is tracked
 * separately.
 *
 * HOS-797 — the cards show the translated TEXT, not just which locales have one.
 * That half lives in `TranslationFieldRow.client.tsx`; this file is the run, the
 * buttons and the messages around it. Showing is the whole delivery: the panel
 * stays read-only by owner decision, and editing a translation is a later one.
 *
 * HOS-2492 — same look as the venue/experience panel: kit `Tabs` per language
 * (each tab counts its untranslated fields), a `StatusPill` per field, kit
 * `Alert` for the missing-translations notice and the run messages, kit
 * `Button`s. The data model and the run logic are untouched.
 */

import { useCallback, useState } from 'react';
import { Alert, Button, Tabs } from '@/components/account/ui';
import type { AccommodationTranslationData } from '@/lib/api/types';
import { visibleApiMessage } from '@/lib/api-errors';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    buildTranslationRows,
    countMissingInLocale,
    LOCALE_LABELS,
    TranslationFieldRow
} from './TranslationFieldRow.client';
import styles from './TranslationPanel.module.css';
import type { GenerationOutcomes, TranslationResultItem } from './translation-status';
import {
    anyFieldFailed,
    anyFieldUntouched,
    anyTranslationPersisted,
    applyRunToTranslations,
    fieldsWithMissingTranslations,
    pendingOutcomes,
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

/** The tabs, source first. */
const PANEL_LOCALES: readonly SupportedLocale[] = ['es', 'en', 'pt'];

/** Shape of the translate endpoint's `data` payload. */
interface TranslateResponse {
    readonly translations?: readonly TranslationResultItem[];
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
 * - `locale` — the page locale. Drives this panel's own copy ONLY; the AI
 *   source locale is `CONTENT_SOURCE_LOCALE`.
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
     * Whether ANY run in this page's lifetime wrote something.
     *
     * Sticky on purpose. Offering the refresh is about whether reloading would
     * show the host anything new, which stays true once a run has written — and a
     * per-run flag would take the offer away on a subsequent failed retry, exactly
     * when the host most wants to reach what the earlier run did manage to save.
     */
    const [hasPersistedAnything, setHasPersistedAnything] = useState(false);
    /**
     * What a finished run wrote, folded over the SSR prop.
     *
     * `translations` is frozen at page render and never refetched. The auto-reload
     * used to hide that; without it the panel would keep showing dashes for locales
     * it had just filled, under a button offering to generate them again — and that
     * second run comes back empty, which the panel reports as an error. The same
     * symptom BETA-199 is about, arriving on the success path.
     */
    const [runFilled, setRunFilled] = useState<AccommodationTranslationData | null>(null);
    /**
     * There is reason to believe the DB holds something this panel is not showing.
     *
     * Two ways to learn that, and both have to set it or the host is left with a
     * contradiction and no way out:
     *
     *  - A requested field came back `untouched`. The backend skips only what is
     *    already filled (`translateEntity`'s skip check trims, same as this panel),
     *    so someone populated it after the page was rendered.
     *  - The request failed in transport. A 90-second budget on ~8 sequential LLM
     *    calls times out on runs the server goes on to finish, so the outcome there
     *    is UNKNOWN, not "nothing happened" — and the fold cannot help, because the
     *    client never saw the results.
     *
     * Derived from the outcome map rather than from `!persisted`: a run that mixes
     * a failure with a skip returns through the error branch, which is why keying
     * it off the no-writes case missed exactly that combination.
     */
    const [mayBeStale, setMayBeStale] = useState(false);
    const effectiveTranslations = runFilled ?? translations;

    const pendingFields = fieldsWithMissingTranslations({
        translations: effectiveTranslations,
        sourceLocale: CONTENT_SOURCE_LOCALE
    });
    const canGenerate = pendingFields.length > 0;

    const handleGenerate = useCallback(async () => {
        // The button is `aria-disabled` rather than `disabled` (see the render),
        // so it still receives clicks — this is what makes the guard real.
        if (isGenerating) return;

        const requested = fieldsWithMissingTranslations({
            translations: effectiveTranslations,
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

                // HOS-865: the backend now answers a TOTAL translation failure
                // (every field x locale call failed) with a non-2xx
                // `TRANSLATION_FAILED` instead of a fabricated 200, so this
                // branch is the one that now also catches that case. Keying
                // off `error.code` rather than `error.status` because this
                // route's genuine network/timeout failures never carry this
                // code, so the check cannot misfire on those.
                const isKnownTotalFailure = result.error.code === 'TRANSLATION_FAILED';

                // A known total failure means nothing was translated and
                // nothing was written — there is no "the server may have kept
                // going without us" case to hedge against, unlike a real
                // timeout. Setting `mayBeStale` here would offer a refresh
                // that finds nothing new, which is exactly the offer the
                // pre-fix `ok: true` + all-`success:false` path (see
                // `summarizeOutcomes` below) never made either — so this
                // keeps parity with it rather than inheriting the timeout
                // branch's more pessimistic assumption.
                if (!isKnownTotalFailure) {
                    // The outcome is unknown, not empty: this budget times out
                    // on runs the server finishes. Withholding the refresh here
                    // strands the host on stale rows with a live button and a
                    // 90-second retry.
                    setMayBeStale(true);
                }

                setErrorMessage(
                    isKnownTotalFailure
                        ? t(
                              'host.properties.editor.translation.allFailed',
                              'No se pudo generar ninguna traducción. Revisá el detalle por campo e intentá de nuevo.'
                          )
                        : visibleApiMessage({ error: result.error }) ||
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
            setRunFilled(applyRunToTranslations({ translations: effectiveTranslations, results }));

            const persisted = anyTranslationPersisted({ results, requested });
            if (persisted) setHasPersistedAnything(true);

            // Before the failed branch returns: a run can both fail one field and
            // skip another, and the skip is what says the DB moved on without us.
            if (anyFieldUntouched(runOutcomes)) setMayBeStale(true);

            const failed = anyFieldFailed(runOutcomes);

            if (failed) {
                setErrorMessage(
                    persisted
                        ? t(
                              'host.properties.editor.translation.partialFailure',
                              'Algunas traducciones no se generaron. Revisá el detalle por campo.'
                          )
                        : t(
                              'host.properties.editor.translation.allFailed',
                              'No se pudo generar ninguna traducción. Revisá el detalle por campo e intentá de nuevo.'
                          )
                );
                return;
            }

            if (!persisted) {
                // Nothing failed and nothing was written for a field we asked
                // about: the backend skipped every requested pair because it found
                // them already filled — someone else filled them between the page
                // render and this click. That is not a failure, so it does not go
                // through the error channel; it goes where the success message
                // goes, and it sets `mayBeStale` because the DB is now AHEAD
                // of the frozen prop. That is the one case where reloading is the
                // only remedy, and gating the refresh on `hasPersistedAnything`
                // alone withheld it precisely there.
                setSuccessMessage(
                    t(
                        'host.properties.editor.translation.nothingGenerated',
                        'No había traducciones pendientes para generar.'
                    )
                );
                return;
            }

            setSuccessMessage(
                t('host.properties.editor.translation.successMessage', 'Traducciones generadas.')
            );
        } catch {
            setOutcomes(null);
            setMayBeStale(true);
            setErrorMessage(
                t(
                    'host.properties.editor.translation.errorNetwork',
                    'Error de conexión al intentar generar las traducciones.'
                )
            );
        } finally {
            setIsGenerating(false);
        }
    }, [accommodationId, effectiveTranslations, isGenerating, t]);

    const handleRefresh = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    }, []);

    /**
     * Whether a reload could show the host something the panel cannot.
     *
     * Two independent reasons, and the second is why this is not just the sticky
     * write flag. `hasPersistedAnything` covers a run that wrote: since HOS-797 the
     * fold renders the text the run returned, so a reload mainly re-reads it from
     * the DB — which still matters, because a reported success is the provider's
     * and not the database's, and because a locale that came back without text
     * shows as unreadable until then. `mayBeStale` covers the opposite case, a run
     * that wrote NOTHING because everything was already filled by someone else;
     * there the DB is ahead of the frozen prop and a reload is the only remedy.
     * Gating on the write flag alone withheld the button in exactly that case,
     * leaving the host with dashes, a message saying there was nothing to do, and
     * no way to reconcile the two.
     *
     * Hidden during a run, because a refresh mid-flight would abandon it. Note
     * what this button costs: it reloads the page, and the editor form around this
     * panel has no unsaved-changes guard, so a draft dies with it. The label does
     * not say so — tracked in BETA-203.
     */
    const canRefresh = (hasPersistedAnything || mayBeStale) && !isGenerating;

    const rows = buildTranslationRows({ translations: effectiveTranslations, t });
    const statuses = rows.map((row) => row.status);
    const missingByLocale = PANEL_LOCALES.map((panelLocale) => ({
        locale: panelLocale,
        count: countMissingInLocale({
            statuses,
            sourceLocale: CONTENT_SOURCE_LOCALE,
            locale: panelLocale
        })
    }));
    const missingLocales = missingByLocale
        .filter((entry) => entry.count > 0)
        .map((entry) => LOCALE_LABELS[entry.locale]);

    const tabs = missingByLocale.map(({ locale: panelLocale, count }) => ({
        id: panelLocale,
        label: LOCALE_LABELS[panelLocale],
        ...(count > 0
            ? {
                  count,
                  countLabel: t('host.properties.editor.translation.missingCount', undefined, {
                      count
                  })
              }
            : {}),
        panel: (
            <ul className={styles.fieldList}>
                {rows.map((row) => (
                    <TranslationFieldRow
                        key={row.field}
                        status={row.status}
                        sourceLocale={CONTENT_SOURCE_LOCALE}
                        displayLocale={panelLocale}
                        fieldLabel={row.label}
                        outcome={outcomes?.[row.field]}
                        t={t}
                    />
                ))}
            </ul>
        )
    }));

    return (
        <fieldset className={`${styles.section} ${styles.bare}`}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.translation.sectionTitle', 'Traducciones')}
            </legend>

            <p className={styles.sectionDescription}>
                {t(
                    'host.properties.editor.translation.sectionDescription',
                    'Estado de traducción de los campos principales de tu propiedad. Las traducciones faltantes se generan automáticamente con IA a partir del contenido en español.'
                )}
            </p>

            {missingLocales.length > 0 && (
                <Alert
                    tone="info"
                    locale={locale}
                >
                    {t('host.properties.editor.translation.missingNotice', undefined, {
                        locales: missingLocales.join(', ')
                    })}
                </Alert>
            )}

            {/* The per-field notes change while the host waits, so the region
                that holds them is the one that has to be live. `aria-busy`
                defers the announcement to the FINAL state (HOS-317), and the
                translated text stays inside on purpose (HOS-797): a live region
                announces what changed, which is the result itself. */}
            <div
                className={styles.region}
                aria-live="polite"
                aria-busy={isGenerating}
            >
                <Tabs
                    items={tabs}
                    ariaLabel={t('host.properties.editor.translation.sectionTitle', 'Traducciones')}
                    defaultValue={CONTENT_SOURCE_LOCALE}
                />
            </div>

            <div className={styles.actions}>
                {canGenerate && (
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={handleGenerate}
                        // `aria-disabled`, not `disabled`: disabling the control
                        // the host just activated drops focus to <body>. This
                        // stays focusable; `handleGenerate` returns early instead.
                        aria-disabled={isGenerating}
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
                    </Button>
                )}

                {canRefresh && (
                    <Button
                        variant="secondary"
                        size="lg"
                        onClick={handleRefresh}
                    >
                        {t('host.properties.editor.translation.refresh', 'Actualizar la página')}
                    </Button>
                )}
            </div>

            {errorMessage && (
                <Alert
                    tone="danger"
                    locale={locale}
                >
                    {errorMessage}
                </Alert>
            )}

            {successMessage && (
                <Alert
                    tone="success"
                    locale={locale}
                >
                    {successMessage}
                </Alert>
            )}
        </fieldset>
    );
}
