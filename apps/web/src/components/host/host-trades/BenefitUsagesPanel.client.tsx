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

import { CheckCircleIcon, ReceiptIcon } from '@repo/icons';
import { useCallback, useState } from 'react';
import {
    Alert,
    CountPill,
    DataList,
    EmptyState,
    ErrorState,
    FilterChips,
    Pagination,
    Section,
    Skeleton
} from '@/components/account/ui';
import type { BenefitUsage, BenefitUsageStatus } from '@/lib/api/endpoints-protected';
import { hostTradesApi } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
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

/** Help anchors of the two sections. */
const INBOX_HELP_ID = 'section:hosttrades.usages-inbox' as const;
const HISTORY_HELP_ID = 'section:hosttrades.usages-history' as const;

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

    const [pending, setPending] = useState<readonly BenefitUsage[]>(initialPending);
    const [history, setHistory] = useState<readonly BenefitUsage[]>(initialHistory);
    const [historyTotal, setHistoryTotal] = useState(initialHistoryTotal);
    const [filter, setFilter] = useState<HistoryFilter>('ALL');
    const [historyLoading, setHistoryLoading] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    // A failed READ of the lists is an error state with a retry: showing the
    // empty copy («no tenés usos pendientes») to a host whose lists did not load
    // would be the false answer. A failed ACTION is an alert above the lists.
    const [readFailed, setReadFailed] = useState(loadFailed);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
     * Re-reads BOTH lists after a transition (or a retry).
     *
     * Confirming moves a row out of the inbox and into the history under a new
     * state, and rejecting can trip the provider's suspension threshold — so
     * patching the two lists locally would drift from what the server now holds.
     *
     * @returns True when both reads worked.
     */
    const refreshAll = useCallback(async (): Promise<boolean> => {
        const [pendingResult, historyResult] = await Promise.all([
            hostTradesApi.listPendingUsages({ page: 1, pageSize: PAGE_SIZE }),
            fetchHistory(filter, 1)
        ]);

        if (pendingResult.ok) setPending(pendingResult.data.items);
        if (historyResult.ok) {
            setHistory(historyResult.data.items);
            setHistoryTotal(historyResult.data.pagination.total);
        }
        return pendingResult.ok && historyResult.ok;
    }, [fetchHistory, filter]);

    /** Retry of a failed read: re-reads both lists and leaves the error state on success. */
    const retryRead = useCallback(async () => {
        const ok = await refreshAll();
        setReadFailed(!ok);
    }, [refreshAll]);

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

    /** Appends the next page; a failure rejects so the paginator says so and offers a retry. */
    const loadMore = useCallback(async () => {
        const nextPage = Math.floor(history.length / PAGE_SIZE) + 1;
        const result = await fetchHistory(filter, nextPage);

        if (!result.ok) throw new Error(result.error.code ?? 'LOAD_MORE_FAILED');

        setHistory((current) => [...current, ...result.data.items]);
        setHistoryTotal(result.data.pagination.total);
        return { addedCount: result.data.items.length };
    }, [fetchHistory, filter, history.length]);

    const filterItems = FILTERS.map((value) => ({
        value,
        label: t(`host-trades.usages.filters.${value}`, FILTER_FALLBACK[value]),
        exclusive: value === 'ALL'
    }));

    if (readFailed) {
        return (
            <div className={styles.panel}>
                <ErrorState
                    variant="inline"
                    locale={locale}
                    onRetry={retryRead}
                    description={t(
                        'host-trades.usages.errors.load',
                        'No pudimos cargar tus usos del beneficio. Probá recargar la página.'
                    )}
                />
            </div>
        );
    }

    return (
        <div className={styles.panel}>
            {errorMessage ? (
                <Alert
                    tone="danger"
                    locale={locale}
                >
                    {errorMessage}
                </Alert>
            ) : null}

            <Section
                title={t('host-trades.usages.pending.title', 'Esperan tu confirmación')}
                helpId={INBOX_HELP_ID}
                actions={
                    pending.length > 0 ? (
                        <CountPill
                            count={pending.length}
                            variant="solid"
                            label={t('host-trades.usages.pending.countLabel', undefined, {
                                count: String(pending.length)
                            })}
                        />
                    ) : undefined
                }
            >
                {pending.length === 0 ? (
                    <EmptyState
                        variant="compact"
                        icon={
                            <CheckCircleIcon
                                size={28}
                                aria-hidden={true}
                            />
                        }
                        title={t(
                            'host-trades.usages.pending.empty',
                            'No tenés usos pendientes de confirmar.'
                        )}
                        description={t('host-trades.usages.pending.emptyDescription')}
                    />
                ) : (
                    <DataList
                        label={t('host-trades.usages.pending.title', 'Esperan tu confirmación')}
                    >
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
                    </DataList>
                )}
            </Section>

            <Section
                title={t('host-trades.usages.history.title', 'Historial')}
                helpId={HISTORY_HELP_ID}
            >
                <FilterChips
                    label={t('host-trades.usages.history.filterLabel', 'Filtrar por estado')}
                    items={filterItems}
                    value={filter}
                    onChange={(next) => void changeFilter((next ?? 'ALL') as HistoryFilter)}
                    className={styles.filters}
                />

                {historyLoading ? (
                    <Skeleton
                        locale={locale}
                        lines={3}
                    />
                ) : history.length === 0 ? (
                    <EmptyState
                        variant="compact"
                        icon={
                            <ReceiptIcon
                                size={28}
                                aria-hidden={true}
                            />
                        }
                        title={t(
                            'host-trades.usages.history.empty',
                            'Todavía no hay usos registrados.'
                        )}
                        description={t('host-trades.usages.history.emptyDescription')}
                    />
                ) : (
                    <DataList label={t('host-trades.usages.history.title', 'Historial')}>
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
                    </DataList>
                )}

                {!historyLoading && history.length < historyTotal ? (
                    <Pagination
                        variant="loadMore"
                        locale={locale}
                        onLoadMore={loadMore}
                    />
                ) : null}
            </Section>

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
