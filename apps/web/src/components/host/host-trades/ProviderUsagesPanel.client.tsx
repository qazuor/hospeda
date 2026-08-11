/**
 * @file ProviderUsagesPanel.client.tsx
 * @description The provider's "Usos" tab (HOS-376 T-050, §8).
 *
 * Two halves: declaring a usage, and the record of what has been declared.
 *
 * DECLARING HAS TWO CHANNELS AND THEY ARE NOT INTERCHANGEABLE. The selector
 * lists only hosts with a confirmed usage already — that scope IS its privacy
 * property, since it exposes nobody the provider has not served. The email
 * fallback exists for the first job with someone, and its failure is reported
 * EXPLICITLY (`HOST_NOT_FOUND`): a typo is the most frequent thing that goes
 * wrong here, and hiding it would leave the provider waiting 30 days for a
 * confirmation that can never arrive.
 *
 * Exactly one identifier travels. The form makes that structural by asking
 * which channel first, rather than presenting two fields and hoping.
 */

import { useCallback, useEffect, useId, useState } from 'react';
import type { BenefitUsage, BenefitUsageStatus, LinkedHost } from '@/lib/api/endpoints-protected';
import { hostTradesApi } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format-utils';
import { parseCalendarDate } from '@/lib/host/benefit-usage-view';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ProviderPanels.module.css';

const PAGE_SIZE = 20;
const NOTE_MAX = 300;

/** Fallback copy per state, so an untranslated key never surfaces raw. */
const STATUS_FALLBACK: Readonly<Record<BenefitUsageStatus, string>> = {
    PENDING: 'Pendiente',
    CONFIRMED: 'Confirmado',
    REJECTED: 'Rechazado',
    EXPIRED: 'Vencido'
};

/** Badge class per state. */
const BADGE_CLASS: Readonly<Record<BenefitUsageStatus, string>> = {
    PENDING: 'badgePending',
    CONFIRMED: 'badgeConfirmed',
    REJECTED: 'badgeRejected',
    EXPIRED: 'badgeExpired'
};

interface ProviderUsagesPanelProps {
    readonly locale: SupportedLocale;
    /** The listing's usages, as the page read them. */
    readonly initialUsages: readonly BenefitUsage[];
    readonly initialTotal: number;
    /** Hosts already linked by a confirmed usage. */
    readonly initialLinkedHosts: readonly LinkedHost[];
    /** Today as `YYYY-MM-DD`, resolved server-side in the market's timezone. */
    readonly today: string;
    /** Set when the listing cannot declare at all, with the reason. */
    readonly suspendedReason?: string | null;
}

/**
 * Renders the declaration form and the listing's usage record.
 *
 * @param props - Locale, the server-read lists, today, and any suspension.
 * @returns The panel element.
 */
export function ProviderUsagesPanel({
    locale,
    initialUsages,
    initialTotal,
    initialLinkedHosts,
    today,
    suspendedReason = null
}: ProviderUsagesPanelProps) {
    const { t } = createTranslations(locale);

    const channelId = useId();
    const hostFieldId = useId();
    const dateFieldId = useId();
    const noteFieldId = useId();

    const [usages, setUsages] = useState<readonly BenefitUsage[]>(initialUsages);
    const [total, setTotal] = useState(initialTotal);
    const [channel, setChannel] = useState<'selector' | 'email'>(
        initialLinkedHosts.length > 0 ? 'selector' : 'email'
    );
    const [hostUserId, setHostUserId] = useState('');
    const [hostEmail, setHostEmail] = useState('');
    const [servicedAt, setServicedAt] = useState(today);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [declared, setDeclared] = useState(false);

    const isSuspended = suspendedReason !== null;

    const refresh = useCallback(async () => {
        const result = await hostTradesApi.listOwnUsages({ page: 1, pageSize: PAGE_SIZE });
        if (result.ok) {
            setUsages(result.data.items);
            setTotal(result.data.pagination.total);
        }
    }, []);

    // A declaration ages the list, and the pending count on it is the number the
    // provider came here to watch.
    useEffect(() => {
        if (!declared) return;
        void refresh();
    }, [declared, refresh]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;

        setErrorMessage(null);
        setDeclared(false);

        if (channel === 'selector' && !hostUserId) {
            setErrorMessage(
                t('host-trades.provider.usages.errors.hostRequired', 'Elegí a quién atendiste.')
            );
            return;
        }
        if (channel === 'email' && hostEmail.trim().length === 0) {
            setErrorMessage(
                t(
                    'host-trades.provider.usages.errors.emailRequired',
                    'Escribí el email del anfitrión.'
                )
            );
            return;
        }
        if (!servicedAt) {
            setErrorMessage(
                t('host-trades.provider.usages.errors.dateRequired', 'Elegí el día del servicio.')
            );
            return;
        }
        // String comparison is exact: both sides are zero-padded `YYYY-MM-DD`.
        if (servicedAt > today) {
            setErrorMessage(
                t(
                    'host-trades.provider.usages.errors.dateFuture',
                    'El servicio no puede ser en el futuro.'
                )
            );
            return;
        }

        setSubmitting(true);
        const trimmedNote = note.trim();
        const result = await hostTradesApi.declareUsageAsProvider({
            servicedAt,
            // Exactly one identifier: the API refuses a body carrying both.
            ...(channel === 'selector' ? { hostUserId } : { hostEmail: hostEmail.trim() }),
            note: trimmedNote.length > 0 ? trimmedNote : undefined
        });
        setSubmitting(false);

        if (!result.ok) {
            setErrorMessage(
                translateApiError({
                    error: result.error,
                    t,
                    fallback: t(
                        'host-trades.provider.usages.errors.generic',
                        'No pudimos registrar el uso. Probá de nuevo en un momento.'
                    )
                })
            );
            return;
        }

        setNote('');
        setHostEmail('');
        setDeclared(true);
    }

    return (
        <div className={styles.panel}>
            {isSuspended ? (
                <div
                    className={styles.notice}
                    role="alert"
                >
                    <p className={styles.noticeTitle}>
                        {t(
                            'host-trades.provider.usages.suspended.title',
                            'No podés registrar usos por ahora'
                        )}
                    </p>
                    <p className={styles.noticeBody}>{suspendedReason}</p>
                    <p className={styles.noticeBody}>
                        {t(
                            'host-trades.provider.usages.suspended.help',
                            'Escribinos para revisarlo. Tus usos ya confirmados siguen contando.'
                        )}
                    </p>
                </div>
            ) : (
                <form
                    className={styles.form}
                    onSubmit={handleSubmit}
                    noValidate
                >
                    <h3 className={styles.formTitle}>
                        {t(
                            'host-trades.provider.usages.form.title',
                            'Registrar un uso del beneficio'
                        )}
                    </h3>

                    <fieldset className={styles.channelGroup}>
                        <legend
                            className={styles.label}
                            id={channelId}
                        >
                            {t('host-trades.provider.usages.form.channel', '¿A quién atendiste?')}
                        </legend>
                        <label className={styles.choice}>
                            <input
                                checked={channel === 'selector'}
                                disabled={initialLinkedHosts.length === 0}
                                name={`${channelId}-channel`}
                                onChange={() => setChannel('selector')}
                                type="radio"
                            />
                            {t(
                                'host-trades.provider.usages.form.channelSelector',
                                'Un cliente que ya me confirmó un uso'
                            )}
                        </label>
                        <label className={styles.choice}>
                            <input
                                checked={channel === 'email'}
                                name={`${channelId}-channel`}
                                onChange={() => setChannel('email')}
                                type="radio"
                            />
                            {t(
                                'host-trades.provider.usages.form.channelEmail',
                                'Alguien nuevo, por su email'
                            )}
                        </label>
                    </fieldset>

                    {channel === 'selector' ? (
                        <div className={styles.field}>
                            <label
                                className={styles.label}
                                htmlFor={hostFieldId}
                            >
                                {t('host-trades.provider.usages.form.host', 'Anfitrión')}
                            </label>
                            <select
                                className={styles.input}
                                id={hostFieldId}
                                onChange={(event) => setHostUserId(event.target.value)}
                                value={hostUserId}
                            >
                                <option value="">
                                    {t(
                                        'host-trades.provider.usages.form.hostPlaceholder',
                                        'Elegí uno…'
                                    )}
                                </option>
                                {initialLinkedHosts.map((host) => (
                                    <option
                                        key={host.id}
                                        value={host.id}
                                    >
                                        {host.displayName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className={styles.field}>
                            <label
                                className={styles.label}
                                htmlFor={hostFieldId}
                            >
                                {t('host-trades.provider.usages.form.email', 'Email del anfitrión')}
                            </label>
                            <input
                                autoComplete="off"
                                className={styles.input}
                                id={hostFieldId}
                                onChange={(event) => setHostEmail(event.target.value)}
                                type="email"
                                value={hostEmail}
                            />
                            <p className={styles.hint}>
                                {t(
                                    'host-trades.provider.usages.form.emailHint',
                                    'Tiene que ser el email con el que se registró en Hospeda. Si no coincide, te lo avisamos en el momento.'
                                )}
                            </p>
                        </div>
                    )}

                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor={dateFieldId}
                        >
                            {t(
                                'host-trades.provider.usages.form.date',
                                '¿Qué día fue el servicio?'
                            )}
                        </label>
                        <input
                            className={styles.input}
                            id={dateFieldId}
                            max={today}
                            onChange={(event) => setServicedAt(event.target.value)}
                            type="date"
                            value={servicedAt}
                        />
                    </div>

                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor={noteFieldId}
                        >
                            {t('host-trades.provider.usages.form.note', 'Nota (opcional)')}
                        </label>
                        <textarea
                            className={styles.textarea}
                            id={noteFieldId}
                            maxLength={NOTE_MAX}
                            onChange={(event) => setNote(event.target.value)}
                            rows={2}
                            value={note}
                        />
                    </div>

                    {errorMessage ? (
                        <p
                            className={styles.error}
                            role="alert"
                        >
                            {errorMessage}
                        </p>
                    ) : null}

                    {declared ? (
                        <p
                            className={styles.success}
                            role="status"
                        >
                            {t(
                                'host-trades.provider.usages.form.success',
                                'Listo. Le pedimos al anfitrión que lo confirme; hasta entonces queda pendiente y no suma a tus números.'
                            )}
                        </p>
                    ) : null}

                    <button
                        className={styles.primaryAction}
                        disabled={submitting}
                        type="submit"
                    >
                        {submitting
                            ? t('host-trades.provider.usages.form.submitting', 'Registrando…')
                            : t('host-trades.provider.usages.form.submit', 'Registrar el uso')}
                    </button>
                </form>
            )}

            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    {t('host-trades.provider.usages.list.title', 'Usos registrados')}
                    {total > 0 ? ` (${total})` : ''}
                </h3>

                {usages.length === 0 ? (
                    <p className={styles.empty}>
                        {t(
                            'host-trades.provider.usages.list.empty',
                            'Todavía no registraste ningún uso del beneficio.'
                        )}
                    </p>
                ) : (
                    <ul className={styles.list}>
                        {usages.map((usage) => {
                            const servicedOn = parseCalendarDate(usage.servicedAt);
                            return (
                                <li
                                    className={styles.row}
                                    key={usage.id}
                                >
                                    <div>
                                        <p className={styles.rowTitle}>
                                            {servicedOn
                                                ? formatDate({ date: servicedOn, locale })
                                                : usage.servicedAt}
                                        </p>
                                        <p className={styles.rowMeta}>
                                            {usage.declaredBy === 'PROVIDER'
                                                ? t(
                                                      'host-trades.provider.usages.list.declaredByYou',
                                                      'Lo registraste vos'
                                                  )
                                                : t(
                                                      'host-trades.provider.usages.list.declaredByHost',
                                                      'Lo registró el anfitrión'
                                                  )}
                                        </p>
                                        {usage.note ? (
                                            <p className={styles.rowMeta}>“{usage.note}”</p>
                                        ) : null}
                                    </div>
                                    <span
                                        className={cn(
                                            styles.badge,
                                            styles[BADGE_CLASS[usage.status]]
                                        )}
                                    >
                                        {t(
                                            `host-trades.usages.status.${usage.status}`,
                                            STATUS_FALLBACK[usage.status]
                                        )}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}
