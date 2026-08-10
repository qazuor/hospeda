/**
 * @file RegisterUsageForm.client.tsx
 * @description The form a host completes after scanning a provider's QR code
 * (HOS-376 T-045). Declares a benefit usage, which the provider then confirms.
 *
 * Native HTML + local state, not TanStack Form — that is admin-only here.
 *
 * Why the date is a plain `YYYY-MM-DD` string end to end: `serviced_at` is a
 * Postgres `date`, and coercing through a `Date` attaches a UTC midnight that
 * shifts the day BACKWARDS for every Argentine caller (UTC-3), turning "I was
 * there on the 1st" into the 31st. `<input type="date">` already yields exactly
 * that string, so the value is never converted at all.
 *
 * Every `t()` call passes a real Spanish fallback rather than an empty one:
 * `resolve()` treats `''` as absent (`if (fallback)`), so an empty fallback
 * surfaces the raw dotted key in production instead of copy.
 */

import { useId, useState } from 'react';
import { hostTradesApi } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './RegisterUsageForm.module.css';

/** Maximum length of the optional note, mirroring `HOST_TRADE_USAGE_NOTE_MAX`. */
const NOTE_MAX = 300;

interface RegisterUsageFormProps {
    readonly locale: SupportedLocale;
    /** Slug of the provider the QR named — the only identifier the POST needs. */
    readonly providerSlug: string;
    /** Provider display name, for the confirmation copy. */
    readonly providerName: string;
    /** Today as `YYYY-MM-DD`, resolved by the caller so both agree on the day. */
    readonly today: string;
}

/**
 * Renders the declaration form, then its success state.
 *
 * @param props - Locale, the provider's slug and name, and today's date.
 * @returns The form, or the confirmation once the usage is recorded.
 */
export function RegisterUsageForm({
    locale,
    providerSlug,
    providerName,
    today
}: RegisterUsageFormProps) {
    const { t } = createTranslations(locale);

    const dateFieldId = useId();
    const noteFieldId = useId();
    const noteCounterId = useId();
    const errorId = useId();

    // Pre-filled with today: the overwhelmingly common case is a host scanning
    // the code while the tradesperson is still standing there.
    const [servicedAt, setServicedAt] = useState(today);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [recorded, setRecorded] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;

        setErrorMessage(null);

        if (!servicedAt) {
            setErrorMessage(
                t('host-trades.registerUsage.errors.dateRequired', 'Elegí el día del servicio.')
            );
            return;
        }
        // A future service date is not worth a round-trip: the host is declaring
        // something that already happened. String comparison is exact here
        // because both sides are zero-padded `YYYY-MM-DD`.
        if (servicedAt > today) {
            setErrorMessage(
                t(
                    'host-trades.registerUsage.errors.dateFuture',
                    'El servicio no puede ser en el futuro.'
                )
            );
            return;
        }

        setSubmitting(true);

        const trimmed = note.trim();
        const result = await hostTradesApi.declareUsage({
            slug: providerSlug,
            servicedAt,
            note: trimmed.length > 0 ? trimmed : undefined
        });

        setSubmitting(false);

        if (!result.ok) {
            // The domain's refusals (USAGE_PENDING_EXISTS, DECLARATION_BLOCKED,
            // DECLARATION_SUSPENDED, PROVIDER_REVOKED) already carry localized
            // copy under `common.apiError.<CODE>`, so the shared translator
            // resolves each one without a branch per code here.
            setErrorMessage(
                translateApiError({
                    error: result.error,
                    t,
                    fallback: t(
                        'host-trades.registerUsage.errors.generic',
                        'No pudimos registrar el uso. Probá de nuevo en un momento.'
                    )
                })
            );
            return;
        }

        setRecorded(true);
    }

    if (recorded) {
        return (
            <div
                className={cn(styles.panel, styles.success)}
                role="status"
            >
                <h2 className={styles.successTitle}>
                    {t('host-trades.registerUsage.success.title', 'Listo, lo registramos')}
                </h2>
                <p className={styles.successBody}>
                    {t(
                        'host-trades.registerUsage.success.body',
                        'Le pedimos a {{name}} que confirme el uso. Cuando lo haga, vas a poder valorarlo.',
                        { name: providerName }
                    )}
                </p>
                <a
                    className={styles.primaryLink}
                    href={buildUrl({ locale, path: 'mi-cuenta/usos-de-beneficio' })}
                >
                    {t('host-trades.registerUsage.success.cta', 'Ver mis usos del beneficio')}
                </a>
            </div>
        );
    }

    const noteRemaining = NOTE_MAX - note.length;

    return (
        <form
            className={styles.panel}
            onSubmit={handleSubmit}
            noValidate
        >
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor={dateFieldId}
                >
                    {t('host-trades.registerUsage.form.date.label', '¿Qué día fue el servicio?')}
                </label>
                <input
                    className={styles.input}
                    id={dateFieldId}
                    max={today}
                    onChange={(event) => setServicedAt(event.target.value)}
                    required
                    type="date"
                    value={servicedAt}
                />
                <p className={styles.hint}>
                    {t(
                        'host-trades.registerUsage.form.date.hint',
                        'Ya viene con la fecha de hoy. Cambiala si el servicio fue otro día.'
                    )}
                </p>
            </div>

            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor={noteFieldId}
                >
                    {t('host-trades.registerUsage.form.note.label', 'Nota (opcional)')}
                </label>
                <textarea
                    aria-describedby={noteCounterId}
                    className={styles.textarea}
                    id={noteFieldId}
                    maxLength={NOTE_MAX}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t(
                        'host-trades.registerUsage.form.note.placeholder',
                        'Por ejemplo: cambio de cerradura en el departamento 3.'
                    )}
                    rows={3}
                    value={note}
                />
                <p
                    className={styles.hint}
                    id={noteCounterId}
                >
                    {t(
                        'host-trades.registerUsage.form.note.counter',
                        'Te quedan {{remaining}} caracteres.',
                        { remaining: String(noteRemaining) }
                    )}
                </p>
            </div>

            {errorMessage ? (
                <p
                    className={styles.error}
                    id={errorId}
                    role="alert"
                >
                    {errorMessage}
                </p>
            ) : null}

            <button
                aria-describedby={errorMessage ? errorId : undefined}
                className={styles.submit}
                disabled={submitting}
                type="submit"
            >
                {submitting
                    ? t('host-trades.registerUsage.form.submitting', 'Registrando…')
                    : t('host-trades.registerUsage.form.submit', 'Registrar el uso')}
            </button>

            <p className={styles.footnote}>
                {t(
                    'host-trades.registerUsage.form.footnote',
                    'Le vamos a pedir a {{name}} que confirme. Hasta que lo haga, el registro queda pendiente.',
                    { name: providerName }
                )}
            </p>
        </form>
    );
}
