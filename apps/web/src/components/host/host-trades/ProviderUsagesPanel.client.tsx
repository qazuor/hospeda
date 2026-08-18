/**
 * @file ProviderUsagesPanel.client.tsx
 * @description The provider's "Usos" tab (HOS-376 T-050, §8).
 *
 * Three halves, and the first one was missing until H-06/H-65/H-159: the INBOX
 * of usages the HOST declared and the provider must answer, the form for
 * declaring one himself, and the record of everything on his listing.
 *
 * WHY THE INBOX IS THE POINT. A host who scans the QR sticker — the flagship
 * channel — opens a PENDING row whose counterpart is the provider. Before this
 * panel had buttons, that row could not be answered from anywhere: it was not in
 * the host's `/usages/pending` (which excludes your own declarations, correctly),
 * and here it rendered as read-only text with a "Pendiente" badge. The
 * notification email even asked the provider to confirm and linked him to this
 * exact screen. Every QR declaration therefore expired after 30 days without
 * counting, and only a CONFIRMED row moves the public counters or unlocks the
 * host's review.
 *
 * ANSWERING IS ROLE-BLIND. The row's `declaredBy` decides who may answer, never
 * the actor's role — an account can be host and provider at once. The predicates
 * live in `@/lib/host/benefit-usage-view` and are shared with the host's panel,
 * so the two sides cannot disagree about who owes whom an answer.
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
import { canUndoRejectionFrom, parseCalendarDate } from '@/lib/host/benefit-usage-view';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ProviderPanels.module.css';
import { RejectUsageDialog } from './RejectUsageDialog.client';

const PAGE_SIZE = 20;
const NOTE_MAX = 300;

/** The side of the flow this panel is read from. */
const SIDE = 'PROVIDER' as const;

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
    /**
     * Rows awaiting THIS provider's answer — PENDING, declared by the host.
     *
     * Narrowed by the API (`status=PENDING&declaredBy=HOST`), never by slicing
     * a page here: a page of pending rows made up of the provider's own
     * declarations would render an empty inbox announcing "nothing waits on
     * you" to someone a host is waiting on.
     */
    readonly initialPending?: readonly BenefitUsage[];
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
    initialPending = [],
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
    const [pending, setPending] = useState<readonly BenefitUsage[]>(initialPending);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [rejectTarget, setRejectTarget] = useState<BenefitUsage | null>(null);
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

    /**
     * Re-reads BOTH lists.
     *
     * Answering moves a row out of the inbox and into the record under a new
     * state, and a rejection can trip the listing's suspension threshold — so
     * patching the two locally would drift from what the server now holds.
     */
    const refresh = useCallback(async () => {
        const [recordResult, inboxResult] = await Promise.all([
            hostTradesApi.listOwnUsages({ page: 1, pageSize: PAGE_SIZE }),
            hostTradesApi.listOwnUsages({
                status: 'PENDING',
                declaredBy: 'HOST',
                page: 1,
                pageSize: PAGE_SIZE
            })
        ]);

        if (recordResult.ok) {
            setUsages(recordResult.data.items);
            setTotal(recordResult.data.pagination.total);
        }
        if (inboxResult.ok) {
            setPending(inboxResult.data.items);
        }
    }, []);

    // A declaration ages the list, and the pending count on it is the number the
    // provider came here to watch.
    useEffect(() => {
        if (!declared) return;
        void refresh();
    }, [declared, refresh]);

    /** Runs one transition, then re-reads. Shared by confirm, reject and undo. */
    const runTransition = useCallback(
        async (
            usage: BenefitUsage,
            action: () => ReturnType<typeof hostTradesApi.confirmUsage>
        ) => {
            if (busyId) return;

            setBusyId(usage.id);
            setActionError(null);

            const result = await action();

            if (!result.ok) {
                // The domain's own refusals already carry localized copy under
                // `common.apiError.<CODE>`, so this resolves each without a
                // branch per code.
                setActionError(
                    translateApiError({
                        error: result.error,
                        t,
                        fallback: t(
                            'host-trades.usages.errors.action',
                            'No pudimos completar la acción. Probá de nuevo en un momento.'
                        )
                    })
                );
                setBusyId(null);
                return;
            }

            await refresh();
            setBusyId(null);
        },
        [busyId, refresh, t]
    );

    const handleConfirm = useCallback(
        (usage: BenefitUsage) =>
            runTransition(usage, () => hostTradesApi.confirmUsage({ id: usage.id })),
        [runTransition]
    );

    const handleUndo = useCallback(
        (usage: BenefitUsage) =>
            runTransition(usage, () => hostTradesApi.undoUsageRejection({ id: usage.id })),
        [runTransition]
    );

    const handleReject = useCallback(
        async (note?: string) => {
            if (!rejectTarget) return;

            const target = rejectTarget;
            setRejectTarget(null);
            await runTransition(target, () => hostTradesApi.rejectUsage({ id: target.id, note }));
        },
        [rejectTarget, runTransition]
    );

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

    /** The counterpart's label for the dialog. The payload carries no host name. */
    const hostLabel = t('host-trades.provider.usages.counterpart', 'el anfitrión');

    return (
        <div className={styles.panel}>
            {actionError ? (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {actionError}
                </p>
            ) : null}

            {/* The inbox sits OUTSIDE the suspension branch on purpose: a
                suspension stops a provider from DECLARING, not from answering
                what a host declared about him. Hiding this would leave rows he
                is the only person able to resolve stuck until they expire. */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    {t('host-trades.provider.usages.pending.title', 'Esperan tu confirmación')}
                    {pending.length > 0 ? ` (${pending.length})` : ''}
                </h3>

                {pending.length === 0 ? (
                    <p className={styles.empty}>
                        {t(
                            'host-trades.provider.usages.pending.empty',
                            'No tenés usos pendientes de confirmar.'
                        )}
                    </p>
                ) : (
                    <ul className={styles.list}>
                        {pending.map((usage) => {
                            const servicedOn = parseCalendarDate(usage.servicedAt);
                            return (
                                <li
                                    className={styles.row}
                                    key={usage.id}
                                >
                                    <div className={styles.rowBody}>
                                        <p className={styles.rowTitle}>
                                            {servicedOn
                                                ? formatDate({ date: servicedOn, locale })
                                                : usage.servicedAt}
                                        </p>
                                        <p className={styles.rowMeta}>
                                            {t(
                                                'host-trades.provider.usages.pending.declaredByHost',
                                                'Lo registró el anfitrión. Confirmalo para que cuente en tus números.'
                                            )}
                                        </p>
                                        {usage.note ? (
                                            <p className={styles.rowMeta}>“{usage.note}”</p>
                                        ) : null}
                                        <div className={styles.actions}>
                                            <button
                                                className={styles.primaryAction}
                                                disabled={busyId === usage.id}
                                                onClick={() => handleConfirm(usage)}
                                                type="button"
                                            >
                                                {t(
                                                    'host-trades.usages.actions.confirm',
                                                    'Confirmar'
                                                )}
                                            </button>
                                            <button
                                                className={styles.secondaryAction}
                                                disabled={busyId === usage.id}
                                                onClick={() => setRejectTarget(usage)}
                                                type="button"
                                            >
                                                {t('host-trades.usages.actions.reject', 'Rechazar')}
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

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
                                        {/* Undo is what makes "rejecting is reversible"
                                            true rather than a promise, and it is offered
                                            only where it works: only the account that
                                            rejected may reverse it, so a row the provider
                                            declared and the HOST rejected gets no button —
                                            its request would 404. */}
                                        {canUndoRejectionFrom(usage, SIDE) ? (
                                            <div className={styles.actions}>
                                                <button
                                                    className={styles.secondaryAction}
                                                    disabled={busyId === usage.id}
                                                    onClick={() => handleUndo(usage)}
                                                    type="button"
                                                >
                                                    {t(
                                                        'host-trades.usages.actions.undoRejection',
                                                        'Deshacer el rechazo'
                                                    )}
                                                </button>
                                            </div>
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

            {rejectTarget ? (
                <RejectUsageDialog
                    counterpartName={hostLabel}
                    locale={locale}
                    onCancel={() => setRejectTarget(null)}
                    onConfirm={handleReject}
                />
            ) : null}
        </div>
    );
}
