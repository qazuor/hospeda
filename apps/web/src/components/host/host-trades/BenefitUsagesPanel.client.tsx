/**
 * @file BenefitUsagesPanel.client.tsx
 * @description The host's benefit-usage screen (HOS-376 T-046).
 *
 * Two lists that mean different things. The INBOX is what waits on the host —
 * PENDING rows a provider declared — and it is the same definition the
 * navigation badge counts, so the two can never disagree. The HISTORY is the
 * whole record, including the host's own QR declarations (which wait on the
 * provider) and the CONFIRMED rows that unlock reviewing.
 *
 * Both arrive server-rendered: the page fetches them and hands them in, so the
 * screen is readable before hydration and the skeleton is reserved for what is
 * genuinely a later fetch — changing the history filter, or reloading after a
 * transition.
 *
 * REJECTING IS PRESENTED AS REVERSIBLE, and the undo action on a rejected row is
 * what makes that copy true rather than a promise. Undo is offered only where it
 * works: only the account that rejected may reverse it (see `canUndoRejection`).
 */

import { useCallback, useId, useState } from 'react';
import type { BenefitUsage, BenefitUsageStatus } from '@/lib/api/endpoints-protected';
import { hostTradesApi } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { BenefitUsageCard } from './BenefitUsageCard';
import { BENEFIT_USAGES_UPDATED_EVENT } from './BenefitUsagesCountPill.client';
import styles from './BenefitUsagesPanel.module.css';
import { RejectUsageDialog } from './RejectUsageDialog.client';
import { ReviewFormDialog } from './ReviewFormDialog.client';

/** Rows per page, matching what the page asked for server-side. */
const PAGE_SIZE = 20;

/** History filter values: the four states, plus "everything". */
const FILTERS = ['ALL', 'PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED'] as const;
type HistoryFilter = (typeof FILTERS)[number];

/** Fallback copy per filter, so an untranslated key never surfaces raw. */
const FILTER_FALLBACK: Readonly<Record<HistoryFilter, string>> = {
    ALL: 'Todos',
    PENDING: 'Pendientes',
    CONFIRMED: 'Confirmados',
    REJECTED: 'Rechazados',
    EXPIRED: 'Vencidos'
};

interface BenefitUsagesPanelProps {
    readonly locale: SupportedLocale;
    /** Rows awaiting the host's answer, as the server rendered them. */
    readonly initialPending: readonly BenefitUsage[];
    /** The first page of the whole record, as the server rendered it. */
    readonly initialHistory: readonly BenefitUsage[];
    /** Unpaginated history size, so "load more" knows whether more exist. */
    readonly initialHistoryTotal: number;
    /** True when the server could not read the lists at all. */
    readonly loadFailed?: boolean;
}

/**
 * Renders the inbox, the history and the rejection dialog.
 *
 * @param props - Locale plus the server-rendered lists.
 * @returns The panel element.
 */
export function BenefitUsagesPanel({
    locale,
    initialPending,
    initialHistory,
    initialHistoryTotal,
    loadFailed = false
}: BenefitUsagesPanelProps) {
    const { t } = createTranslations(locale);

    const noteFieldId = useId();

    const [pending, setPending] = useState<readonly BenefitUsage[]>(initialPending);
    const [history, setHistory] = useState<readonly BenefitUsage[]>(initialHistory);
    const [historyTotal, setHistoryTotal] = useState(initialHistoryTotal);
    const [filter, setFilter] = useState<HistoryFilter>('ALL');
    const [historyLoading, setHistoryLoading] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(
        loadFailed
            ? t(
                  'host-trades.usages.errors.load',
                  'No pudimos cargar tus usos del beneficio. Probá recargar la página.'
              )
            : null
    );

    const [rejectTarget, setRejectTarget] = useState<BenefitUsage | null>(null);
    const [reviewTarget, setReviewTarget] = useState<BenefitUsage | null>(null);

    const genericError = t(
        'host-trades.usages.errors.action',
        'No pudimos completar la acción. Probá de nuevo en un momento.'
    );

    /** Re-reads a history page for the active filter. */
    const fetchHistory = useCallback(
        async (nextFilter: HistoryFilter, page: number) =>
            hostTradesApi.listUsages({
                status: nextFilter === 'ALL' ? undefined : (nextFilter as BenefitUsageStatus),
                page,
                pageSize: PAGE_SIZE
            }),
        []
    );

    /**
     * Re-reads BOTH lists after a transition.
     *
     * Confirming moves a row out of the inbox and into the history under a new
     * state, and rejecting can trip the provider's suspension threshold — so
     * patching the two lists locally would drift from what the server now holds.
     */
    const refreshAll = useCallback(async () => {
        const [pendingResult, historyResult] = await Promise.all([
            hostTradesApi.listPendingUsages({ page: 1, pageSize: PAGE_SIZE }),
            fetchHistory(filter, 1)
        ]);

        if (pendingResult.ok) setPending(pendingResult.data.items);
        if (historyResult.ok) {
            setHistory(historyResult.data.items);
            setHistoryTotal(historyResult.data.pagination.total);
        }
    }, [fetchHistory, filter]);

    /** Runs one transition, then re-reads. Shared by all three actions. */
    const runTransition = useCallback(
        async (
            usage: BenefitUsage,
            action: () => ReturnType<typeof hostTradesApi.confirmUsage>
        ) => {
            if (busyId) return;

            setBusyId(usage.id);
            setErrorMessage(null);

            const result = await action();

            if (!result.ok) {
                // The domain's own refusals already carry localized copy under
                // `common.apiError.<CODE>`, so this resolves each without a
                // branch per code.
                setErrorMessage(
                    translateApiError({ error: result.error, t, fallback: genericError })
                );
                setBusyId(null);
                return;
            }

            await refreshAll();

            // Tells the navigation badge to re-read. The two are separate
            // islands with no shared store, and the badge must clear the moment
            // the usage is RESOLVED — not when this page happens to be opened.
            window.dispatchEvent(new CustomEvent(BENEFIT_USAGES_UPDATED_EVENT));

            setBusyId(null);
        },
        [busyId, genericError, refreshAll, t]
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

    const openRejectDialog = useCallback((usage: BenefitUsage) => setRejectTarget(usage), []);

    const closeRejectDialog = useCallback(() => setRejectTarget(null), []);

    const confirmRejection = useCallback(
        async (note?: string) => {
            if (!rejectTarget) return;

            const target = rejectTarget;
            setRejectTarget(null);

            await runTransition(target, () => hostTradesApi.rejectUsage({ id: target.id, note }));
        },
        [rejectTarget, runTransition]
    );

    const changeFilter = useCallback(
        async (nextFilter: HistoryFilter) => {
            if (nextFilter === filter) return;

            setFilter(nextFilter);
            setHistoryLoading(true);
            setErrorMessage(null);

            const result = await fetchHistory(nextFilter, 1);

            if (result.ok) {
                setHistory(result.data.items);
                setHistoryTotal(result.data.pagination.total);
            } else {
                setErrorMessage(
                    translateApiError({ error: result.error, t, fallback: genericError })
                );
            }

            setHistoryLoading(false);
        },
        [fetchHistory, filter, genericError, t]
    );

    const loadMore = useCallback(async () => {
        setHistoryLoading(true);

        const nextPage = Math.floor(history.length / PAGE_SIZE) + 1;
        const result = await fetchHistory(filter, nextPage);

        if (result.ok) {
            setHistory((current) => [...current, ...result.data.items]);
            setHistoryTotal(result.data.pagination.total);
        } else {
            setErrorMessage(translateApiError({ error: result.error, t, fallback: genericError }));
        }

        setHistoryLoading(false);
    }, [fetchHistory, filter, genericError, history.length, t]);

    return (
        <div className={styles.panel}>
            {errorMessage ? (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {errorMessage}
                </p>
            ) : null}

            <section
                aria-labelledby={`${noteFieldId}-inbox`}
                className={styles.section}
            >
                <h2
                    className={styles.sectionTitle}
                    id={`${noteFieldId}-inbox`}
                >
                    {t('host-trades.usages.pending.title', 'Esperan tu confirmación')}
                </h2>

                {pending.length === 0 ? (
                    <p className={styles.empty}>
                        {t(
                            'host-trades.usages.pending.empty',
                            'No tenés usos pendientes de confirmar.'
                        )}
                    </p>
                ) : (
                    <ul className={styles.list}>
                        {pending.map((usage) => (
                            <BenefitUsageCard
                                answerable
                                busy={busyId === usage.id}
                                key={usage.id}
                                locale={locale}
                                onConfirm={handleConfirm}
                                onReject={openRejectDialog}
                                usage={usage}
                            />
                        ))}
                    </ul>
                )}
            </section>

            <section
                aria-labelledby={`${noteFieldId}-history`}
                className={styles.section}
            >
                <h2
                    className={styles.sectionTitle}
                    id={`${noteFieldId}-history`}
                >
                    {t('host-trades.usages.history.title', 'Historial')}
                </h2>

                {/* A real <fieldset>, not a div with role="group": the filter
                    chips are one control group, and the legend gives assistive
                    technology the label without occupying the layout. */}
                <fieldset className={styles.filters}>
                    <legend className={styles.visuallyHidden}>
                        {t('host-trades.usages.history.filterLabel', 'Filtrar por estado')}
                    </legend>
                    {FILTERS.map((value) => (
                        <button
                            aria-pressed={filter === value}
                            className={cn(styles.filter, filter === value && styles.filterActive)}
                            key={value}
                            onClick={() => changeFilter(value)}
                            type="button"
                        >
                            {t(`host-trades.usages.filters.${value}`, FILTER_FALLBACK[value])}
                        </button>
                    ))}
                </fieldset>

                {historyLoading ? (
                    <ul
                        aria-hidden="true"
                        className={styles.list}
                    >
                        {[0, 1, 2].map((row) => (
                            <li
                                className={styles.skeleton}
                                key={row}
                            />
                        ))}
                    </ul>
                ) : history.length === 0 ? (
                    <p className={styles.empty}>
                        {t('host-trades.usages.history.empty', 'Todavía no hay usos registrados.')}
                    </p>
                ) : (
                    <ul className={styles.list}>
                        {history.map((usage) => (
                            <BenefitUsageCard
                                busy={busyId === usage.id}
                                key={usage.id}
                                locale={locale}
                                onReview={setReviewTarget}
                                onUndoRejection={handleUndo}
                                usage={usage}
                            />
                        ))}
                    </ul>
                )}

                {!historyLoading && history.length < historyTotal ? (
                    <button
                        className={styles.loadMore}
                        onClick={loadMore}
                        type="button"
                    >
                        {t('host-trades.usages.history.loadMore', 'Ver más')}
                    </button>
                ) : null}
            </section>

            {rejectTarget ? (
                <RejectUsageDialog
                    counterpartName={
                        rejectTarget.hostTrade?.name ??
                        t('host-trades.usages.card.unknownProvider', 'Proveedor del directorio')
                    }
                    locale={locale}
                    onCancel={closeRejectDialog}
                    onConfirm={confirmRejection}
                />
            ) : null}

            {reviewTarget?.hostTrade ? (
                <ReviewFormDialog
                    hostTradeId={reviewTarget.hostTrade.id}
                    locale={locale}
                    onClose={() => setReviewTarget(null)}
                    onSaved={() => {
                        // The review does not change any usage, so the lists stay
                        // as they are. The dialog keeps showing its own outcome —
                        // whether it published or went to moderation — until the
                        // host closes it.
                        setErrorMessage(null);
                    }}
                    providerName={reviewTarget.hostTrade.name}
                />
            ) : null}
        </div>
    );
}
