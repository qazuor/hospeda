/**
 * @file ReviewQueueSection.tsx
 * @description The BACKLOG queue (HOS-376 T-055, §6.4).
 *
 * A review is born APPROVED, so nothing is blocked while a row sits here and
 * the moderator's job is the opposite of the reply queue's: not to release what
 * is held, but to find the occasional published item that should come down.
 *
 * It therefore shows every moderation state by default. A queue scoped to
 * PENDING would be empty most of the time and would hide exactly the rows worth
 * acting on; one scoped to APPROVED would have nothing left to moderate.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    type ModerationDecision,
    type ModerationStateFilter,
    useHostTradeReviewsQueue,
    useModerateHostTradeReview
} from '@/hooks/use-host-trade-moderation';
import { useTranslations } from '@/hooks/use-translations';
import { ModerationDecisionButtons } from './ModerationDecisionButtons';

const PAGE_SIZE = 20;

/** The filter options, `all` included as the deliberate default. */
const STATE_OPTIONS = ['all', 'PENDING', 'APPROVED', 'REJECTED'] as const;

/**
 * Renders the review backlog with its moderation-state filter.
 *
 * @returns The section element.
 */
export function ReviewQueueSection() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [stateFilter, setStateFilter] = useState<(typeof STATE_OPTIONS)[number]>('all');
    const [decidingId, setDecidingId] = useState<string | null>(null);

    const { data, isLoading, error } = useHostTradeReviewsQueue({
        page,
        pageSize: PAGE_SIZE,
        moderationState: stateFilter === 'all' ? undefined : (stateFilter as ModerationStateFilter)
    });
    const moderate = useModerateHostTradeReview();

    const items = data?.items ?? [];
    const pagination = data?.pagination;

    function decide(id: string, input: { decision: ModerationDecision; reason?: string }) {
        setDecidingId(id);
        moderate.mutate({ id, ...input }, { onSettled: () => setDecidingId(null) });
    }

    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="font-semibold text-lg">
                        {t('host-trades.moderation.reviews.title')}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {t('host-trades.moderation.reviews.help')}
                    </p>
                </div>

                <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground text-xs">
                        {t('host-trades.moderation.filters.stateLabel')}
                    </span>
                    <select
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        onChange={(event) => {
                            setStateFilter(event.target.value as (typeof STATE_OPTIONS)[number]);
                            setPage(1);
                        }}
                        value={stateFilter}
                    >
                        {STATE_OPTIONS.map((option) => (
                            <option
                                key={option}
                                value={option}
                            >
                                {option === 'all'
                                    ? t('host-trades.moderation.filters.all')
                                    : t(`host-trades.moderation.filters.${option}`)}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {error ? (
                <p
                    className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
                    role="alert"
                >
                    {t('host-trades.moderation.errors.load')}
                </p>
            ) : null}

            {moderate.isError ? (
                <p
                    className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
                    role="alert"
                >
                    {t('host-trades.moderation.errors.moderate')}
                </p>
            ) : null}

            {isLoading ? (
                <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
            ) : items.length === 0 && !error ? (
                <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
                    {t('host-trades.moderation.reviews.empty')}
                </p>
            ) : (
                <ul className="space-y-3">
                    {items.map((review) => (
                        <li
                            className="space-y-2 rounded-md border p-4"
                            key={review.id}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span
                                    aria-hidden="true"
                                    className="text-sm"
                                >
                                    {'★'.repeat(review.overallRating)}
                                    {'☆'.repeat(5 - review.overallRating)}
                                </span>
                                <span className="rounded-full border px-2 py-0.5 text-xs">
                                    {t(`host-trades.moderation.state.${review.moderationState}`)}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                    {review.respectedBenefit
                                        ? t('host-trades.moderation.reviews.benefitYes')
                                        : t('host-trades.moderation.reviews.benefitNo')}
                                </span>
                            </div>

                            <p className="text-sm">
                                {review.content ?? (
                                    <span className="text-muted-foreground">
                                        {t('host-trades.moderation.reviews.noContent')}
                                    </span>
                                )}
                            </p>

                            <ModerationDecisionButtons
                                currentState={review.moderationState}
                                onDecide={(input) => decide(review.id, input)}
                                submitting={decidingId === review.id}
                            />
                        </li>
                    ))}
                </ul>
            )}

            {pagination && pagination.totalPages > 1 ? (
                <nav className="flex items-center justify-center gap-3">
                    <Button
                        disabled={page <= 1}
                        onClick={() => setPage((current) => current - 1)}
                        size="sm"
                        variant="outline"
                    >
                        {t('host-trades.moderation.pagination.previous')}
                    </Button>
                    <span className="text-muted-foreground text-sm">
                        {t('host-trades.moderation.pagination.status', {
                            page: String(pagination.page),
                            total: String(pagination.totalPages)
                        })}
                    </span>
                    <Button
                        disabled={page >= pagination.totalPages}
                        onClick={() => setPage((current) => current + 1)}
                        size="sm"
                        variant="outline"
                    >
                        {t('host-trades.moderation.pagination.next')}
                    </Button>
                </nav>
            ) : null}
        </section>
    );
}
