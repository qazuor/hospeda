/**
 * @file ImportFromUrl.client.tsx
 * @description Host island: paste an external listing URL, confirm the legal
 * notice, and import a pre-filled accommodation draft (SPEC-222 T-023). The
 * "Importar" button stays disabled until the legal checkbox is ticked (AC-1.1).
 * On success the parent receives the import response via `onImported` (the
 * actual form prefill is wired in T-025); a server notice (e.g. AI-quota
 * degraded) is surfaced inline.
 */

import { accommodationsImportApi } from '@/lib/api/endpoints-protected';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { AccommodationImportRequestSchema } from '@repo/schemas';
import type { AccommodationImportResponse } from '@repo/schemas';
import { useId, useState } from 'react';
import styles from './ImportFromUrl.module.css';

/** Platforms shown in the URL-acquisition help panel (US-7), in display order. */
const HELP_PLATFORMS = ['airbnb', 'booking', 'mercadolibre', 'google'] as const;

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
};

/**
 * Renders the import-from-URL form: a URL input, a required legal-confirmation
 * checkbox, and a submit button gated on that checkbox.
 */
export function ImportFromUrl({ locale, onImported }: ImportFromUrlProps) {
    const { t } = createTranslations(locale);
    const urlInputId = useId();
    const legalCheckboxId = useId();

    const [url, setUrl] = useState('');
    const [legalConfirmed, setLegalConfirmed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);

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
        try {
            const result = await accommodationsImportApi.importFromUrl(parsed.data);
            if (!result.ok) {
                setError(
                    t(
                        'host.importFromUrl.errors.submit',
                        'No pudimos importar el alojamiento. Intentá de nuevo.'
                    )
                );
                return;
            }
            if (result.data.message) {
                setNotice(result.data.message);
            }
            onImported?.(result.data);
        } catch (err) {
            webLogger.error('ImportFromUrl: import request failed', {
                err: err instanceof Error ? err.message : String(err)
            });
            setError(
                t('host.importFromUrl.errors.network', 'No pudimos conectar con el servidor.')
            );
        } finally {
            setIsSubmitting(false);
        }
    }

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
