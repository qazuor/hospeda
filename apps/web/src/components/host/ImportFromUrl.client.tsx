/**
 * @file ImportFromUrl.client.tsx
 * @description Host island: paste an external listing URL, confirm the legal
 * notice, and import a pre-filled accommodation draft (SPEC-222 T-023). The
 * "Importar" button stays disabled until the legal checkbox is ticked (AC-1.1).
 * On success the parent receives the import response via `onImported` (the
 * actual form prefill is wired in T-025); a server notice (e.g. AI-quota
 * degraded) is surfaced inline.
 *
 * **HOS-50 / SPEC-277 R3 T-013**: for slow/blocked sources (Airbnb, or
 * Booking on its Apify-fallback branch) the server responds `202` with a run
 * handle instead of the finalized draft. This island then switches to
 * polling mode via `useImportStatus` (T-012), keeping the "Importando..."
 * spinner button active for the entire duration. Once the poll settles, the
 * outcome is handled exactly like the synchronous `200` branch: success calls
 * `onImported`, a classified failure renders the same i18n error banner.
 */

import type { AccommodationImportResponse } from '@repo/schemas';
import { AccommodationImportRequestSchema } from '@repo/schemas';
import { useEffect, useId, useRef, useState } from 'react';
import { type ImportRunHandle, useImportStatus } from '@/hooks/use-import-status';
import { accommodationsImportApi, isAsyncImportStart } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import styles from './ImportFromUrl.module.css';

/** Platforms shown in the URL-acquisition help panel (US-7), in display order. */
const HELP_PLATFORMS = ['airbnb', 'booking', 'mercadolibre', 'google'] as const;

/**
 * Converts a snake_case string to camelCase for i18n key mapping.
 * Used to map `ImportFailureCode` values (snake_case) to their i18n keys (camelCase).
 *
 * @example snakeToCamel('invalid_url') // → 'invalidUrl'
 */
function snakeToCamel(value: string): string {
    return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** Props for the {@link ImportFromUrl} island. */
export type ImportFromUrlProps = {
    /** Active UI locale (passed from Astro at hydration). */
    readonly locale: SupportedLocale;
    /**
     * Called with the import response after a successful import. The parent
     * decides how to pre-fill its form (T-025). Optional so the island can be
     * used standalone.
     */
    readonly onImported?: (response: AccommodationImportResponse) => void;
    /**
     * Called immediately before the import API call is fired (SPEC-258 A7).
     * Receives the detected source string (from the submitted URL) — or
     * `'unknown'` when the URL has not been inspected yet.
     * Optional so the island can be used standalone.
     */
    readonly onAttempt?: (source: string) => void;
    /**
     * Called when the import fails (SPEC-258 A7 / C.1). Receives the machine-
     * readable `ImportFailureCode` (e.g. `'source_blocked'`) when the API
     * returns a classified failure on a 200 response, or `'unknown'` when the
     * HTTP call itself fails (non-ok) and no code is available.
     * Optional so the island can be used standalone.
     */
    readonly onError?: (failureCodeOrUnknown: string) => void;
};

/**
 * Renders the import-from-URL form: a URL input, a required legal-confirmation
 * checkbox, and a submit button gated on that checkbox.
 */
export function ImportFromUrl({ locale, onImported, onAttempt, onError }: ImportFromUrlProps) {
    const { t } = createTranslations(locale);
    const urlInputId = useId();
    const legalCheckboxId = useId();

    const [url, setUrl] = useState('');
    const [legalConfirmed, setLegalConfirmed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    // HOS-50 T-013: non-null while an async Apify run is being polled.
    const [runHandle, setRunHandle] = useState<ImportRunHandle | null>(null);
    // Guards against re-handling a settle outcome on unrelated re-renders
    // while `runHandle` is unchanged, and is reset whenever a NEW run starts.
    const handledSettleRef = useRef(false);

    const pollResult = useImportStatus(runHandle, runHandle !== null);

    const submitDisabled = isSubmitting || !legalConfirmed;

    async function handleSubmit(): Promise<void> {
        setError(null);
        setNotice(null);

        const trimmedUrl = url.trim();
        if (trimmedUrl === '') {
            setError(t('host.importFromUrl.errors.urlRequired', 'Ingresá la URL del alojamiento.'));
            return;
        }

        const parsed = AccommodationImportRequestSchema.safeParse({
            url: trimmedUrl,
            locale,
            legalConfirmed: legalConfirmed === true ? (true as const) : legalConfirmed
        });

        if (!parsed.success) {
            const firstIssue = parsed.error.issues[0];
            const isLegal = firstIssue?.path.includes('legalConfirmed');
            setError(
                isLegal
                    ? t(
                          'host.importFromUrl.errors.legalRequired',
                          'Debés confirmar el aviso legal.'
                      )
                    : t('host.importFromUrl.errors.urlInvalid', 'La URL no es válida.')
            );
            return;
        }

        setIsSubmitting(true);
        // A7: fire attempt event before the API call
        onAttempt?.('unknown');
        try {
            const result = await accommodationsImportApi.importFromUrl(parsed.data);
            if (!result.ok) {
                onError?.('unknown');
                // Surface the specific failure instead of one generic message
                // (BETA-154). 403 (no permission / plan doesn't include import)
                // and 429 (too many imports) get dedicated import-context copy;
                // any other error is localized by `translateApiError` (which also
                // maps code-less statuses via BETA-146), falling back to the
                // generic import message.
                const status = result.error?.status;
                const message =
                    status === 403
                        ? t(
                              'host.importFromUrl.errors.forbidden',
                              'No tenés permiso para importar desde una URL. Verificá que tu plan lo incluya.'
                          )
                        : status === 429
                          ? t(
                                'host.importFromUrl.errors.rateLimit',
                                'Hiciste demasiadas importaciones seguidas. Esperá un momento y probá de nuevo.'
                            )
                          : translateApiError({
                                error: result.error,
                                t,
                                fallback: t(
                                    'host.importFromUrl.errors.submit',
                                    'No pudimos importar el alojamiento. Intentá de nuevo.'
                                )
                            });
                setError(message);
                setIsSubmitting(false);
                return;
            }

            // HOS-50 T-013: a 202 dispatch for a slow/blocked source — switch
            // to polling mode via useImportStatus and keep the "Importando..."
            // spinner active. The outcome is handled by the settle effect below;
            // `isSubmitting` intentionally stays `true` here.
            if (isAsyncImportStart(result.data)) {
                handledSettleRef.current = false;
                setRunHandle(result.data);
                return;
            }

            // Branch 2: 200 response with a machine-readable failureCode — render as error,
            // do NOT fire onImported (SPEC-258 C.1).
            if (result.data.failureCode) {
                const camelKey = snakeToCamel(result.data.failureCode);
                setError(
                    t(
                        `host.importFromUrl.errors.failure.${camelKey}` as Parameters<typeof t>[0],
                        result.data.failureCode
                    )
                );
                onError?.(result.data.failureCode);
                setIsSubmitting(false);
                return;
            }
            if (result.data.message) {
                setNotice(result.data.message);
            }
            onImported?.(result.data);
            setIsSubmitting(false);
        } catch (err) {
            webLogger.error('ImportFromUrl: import request failed', {
                err: err instanceof Error ? err.message : String(err)
            });
            onError?.('unknown');
            setError(
                t('host.importFromUrl.errors.network', 'No pudimos conectar con el servidor.')
            );
            setIsSubmitting(false);
        }
    }

    // HOS-50 T-013: handles the outcome once the polled async run settles —
    // mirrors the synchronous 200 branch above (failureCode -> error banner,
    // success -> notice + onImported). `handledSettleRef` prevents re-running
    // this on unrelated re-renders while `pollResult` keeps reporting the same
    // settled run (the hook's returned object is a fresh literal every call).
    useEffect(() => {
        if (!pollResult.settled || handledSettleRef.current) {
            return;
        }
        handledSettleRef.current = true;
        setIsSubmitting(false);
        setRunHandle(null);

        if (pollResult.failureCode) {
            const camelKey = snakeToCamel(pollResult.failureCode);
            setError(
                t(
                    `host.importFromUrl.errors.failure.${camelKey}` as Parameters<typeof t>[0],
                    pollResult.failureCode
                )
            );
            onError?.(pollResult.failureCode);
            return;
        }

        if (pollResult.draft) {
            if (pollResult.draft.message) {
                setNotice(pollResult.draft.message);
            }
            onImported?.(pollResult.draft);
        }
    }, [pollResult, onError, onImported, t]);

    return (
        <section className={styles.importFromUrl}>
            {/*
             * NOT a <form>: this island is embedded inside the parent
             * CreatePropertyMiniForm's <form>, and nested forms are invalid HTML
             * (the browser un-nests them, making a type="submit" button here
             * trigger the PARENT form's submit instead of the import). The
             * import is driven by an explicit button onClick + Enter handler.
             */}
            <div className="form">
                <div className="form-field">
                    <label
                        className="form-label"
                        htmlFor={urlInputId}
                    >
                        {t('host.importFromUrl.fields.url', 'URL del alojamiento')}
                    </label>
                    <input
                        id={urlInputId}
                        className="form-input"
                        type="url"
                        inputMode="url"
                        value={url}
                        placeholder={t('host.importFromUrl.fields.urlPlaceholder', 'https://...')}
                        onChange={(event) => setUrl(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !submitDisabled) {
                                event.preventDefault();
                                void handleSubmit();
                            }
                        }}
                        disabled={isSubmitting}
                    />
                </div>

                <button
                    type="button"
                    className={styles.helpToggle}
                    onClick={() => setShowHelp((value) => !value)}
                    aria-expanded={showHelp}
                >
                    {t('host.importFromUrl.help.toggle', '¿Cómo obtengo la URL del alojamiento?')}
                </button>

                {showHelp ? (
                    <div className={styles.helpPanel}>
                        <p className={styles.helpTitle}>
                            {t(
                                'host.importFromUrl.help.title',
                                'Cómo copiar la URL según la plataforma'
                            )}
                        </p>
                        <ul className={styles.helpList}>
                            {HELP_PLATFORMS.map((platform) => (
                                <li
                                    key={platform}
                                    className={styles.helpItem}
                                >
                                    <strong>
                                        {t(
                                            `host.importFromUrl.help.platforms.${platform}.name`,
                                            platform
                                        )}
                                    </strong>
                                    <span>
                                        {t(
                                            `host.importFromUrl.help.platforms.${platform}.steps`,
                                            ''
                                        )}
                                    </span>
                                    <code className={styles.helpExample}>
                                        {t(
                                            `host.importFromUrl.help.platforms.${platform}.example`,
                                            ''
                                        )}
                                    </code>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}

                <div className={styles.legalRow}>
                    <input
                        id={legalCheckboxId}
                        type="checkbox"
                        checked={legalConfirmed}
                        onChange={(event) => setLegalConfirmed(event.target.checked)}
                        disabled={isSubmitting}
                    />
                    <label htmlFor={legalCheckboxId}>
                        {t(
                            'host.importFromUrl.fields.legalConfirm',
                            'Confirmo que tengo permiso para importar esta información.'
                        )}
                    </label>
                </div>

                {error ? (
                    <div
                        className="form-error-banner"
                        role="alert"
                    >
                        {error}
                    </div>
                ) : null}

                {notice ? (
                    <output className={cn('form-error-banner', styles.notice)}>{notice}</output>
                ) : null}

                <button
                    type="button"
                    className="btn-gradient"
                    onClick={() => void handleSubmit()}
                    disabled={submitDisabled}
                >
                    {isSubmitting
                        ? t('host.importFromUrl.actions.submitting', 'Importando...')
                        : t('host.importFromUrl.actions.submit', 'Importar')}
                </button>
            </div>
        </section>
    );
}
