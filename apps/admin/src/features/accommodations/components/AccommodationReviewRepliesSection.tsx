/**
 * @file AccommodationReviewRepliesSection.tsx
 * @description Owner replies to an accommodation's reviews, with the moderation
 * controls an admin needs (HOS-2675).
 *
 * The queue defaults to ALL, not PENDING: an APPROVED reply may still be taken
 * down, and hiding it would leave the moderator with no way to reach it. The
 * "Pending moderation" filter is offered explicitly for the blocking work.
 */

import type { AccommodationReviewReplyAdminItem } from '@repo/schemas';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    type AccommodationReviewReplyFilters,
    type ModerationDecision,
    type ModerationStateFilter,
    useAccommodationReviewRepliesQueue,
    useModerateAccommodationReviewReply
} from '@/hooks/use-accommodation-review-reply-moderation';
import { useTranslations } from '@/hooks/use-translations';

const PAGE_SIZE = 20;

type QueueFilter = 'ALL' | ModerationStateFilter;

const FILTER_OPTIONS: readonly QueueFilter[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

/**
 * Renders the owner-reply moderation section for one accommodation.
 *
 * @param props.accommodationId - The accommodation whose replies are moderated.
 * @returns The section element.
 */
export function AccommodationReviewRepliesSection({
    accommodationId
}: {
    readonly accommodationId: string;
}) {
    const { t } = useTranslations();
    const [filter, setFilter] = useState<QueueFilter>('ALL');
    const [page, setPage] = useState(1);
    const [decidingId, setDecidingId] = useState<string | null>(null);

    const filters: AccommodationReviewReplyFilters = {
        accommodationId,
        page,
        pageSize: PAGE_SIZE,
        moderationState: filter === 'ALL' ? undefined : filter
    };

    const { data, isLoading, error } = useAccommodationReviewRepliesQueue(filters);
    const moderate = useModerateAccommodationReviewReply();

    const items = data?.items ?? [];
    const pagination = data?.pagination;

    function decide(id: string, input: { decision: ModerationDecision; reason?: string }) {
        setDecidingId(id);
        moderate.mutate(
            { id, ...input },
            {
                onSettled: () => setDecidingId(null)
            }
        );
    }

    function filterLabel(option: QueueFilter): string {
        switch (option) {
            case 'PENDING':
                return t('admin-pages.accommodations.reviews.replies.filterPending');
            case 'APPROVED':
                return t('admin-pages.accommodations.reviews.replies.filterApproved');
            case 'REJECTED':
                return t('admin-pages.accommodations.reviews.replies.filterRejected');
            default:
                return t('admin-pages.accommodations.reviews.replies.filterAll');
        }
    }

    return (
        <section className="space-y-3 rounded-lg border bg-card p-6">
            <div>
                <h2 className="font-semibold text-lg">
                    {t('admin-pages.accommodations.reviews.replies.title')}
                </h2>
                <p className="text-muted-foreground text-sm">
                    {t('admin-pages.accommodations.reviews.replies.help')}
                </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                    {t('admin-pages.accommodations.reviews.replies.filterLabel')}
                </span>
                <select
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    onChange={(event) => {
                        setFilter(event.target.value as QueueFilter);
                        setPage(1);
                    }}
                    value={filter}
                >
                    {FILTER_OPTIONS.map((option) => (
                        <option
                            key={option}
                            value={option}
                        >
                            {filterLabel(option)}
                        </option>
                    ))}
                </select>
            </label>

            {error ? (
                <p
                    className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
                    role="alert"
                >
                    {t('admin-pages.accommodations.reviews.replies.loadError')}
                </p>
            ) : null}

            {moderate.isError ? (
                <p
                    className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
                    role="alert"
                >
                    {t('admin-pages.accommodations.reviews.replies.moderateError')}
                </p>
            ) : null}

            {isLoading ? (
                <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
            ) : items.length === 0 && !error ? (
                <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
                    {t('admin-pages.accommodations.reviews.replies.empty')}
                </p>
            ) : (
                <ul className="space-y-3">
                    {items.map((reply) => (
                        <ReplyModerationRow
                            key={reply.id}
                            onDecide={(input) => decide(reply.id, input)}
                            reply={reply}
                            submitting={decidingId === reply.id}
                        />
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
                        {t('admin-pages.accommodations.reviews.replies.pagination.previous')}
                    </Button>
                    <span className="text-muted-foreground text-sm">
                        {t('admin-pages.accommodations.reviews.replies.pagination.status', {
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
                        {t('admin-pages.accommodations.reviews.replies.pagination.next')}
                    </Button>
                </nav>
            ) : null}
        </section>
    );
}

/** The state badge for one reply. */
function ModerationStateBadge({ state }: { readonly state: string }) {
    const { t } = useTranslations();

    const label =
        state === 'APPROVED'
            ? t('admin-pages.accommodations.reviews.replies.stateApproved')
            : state === 'REJECTED'
              ? t('admin-pages.accommodations.reviews.replies.stateRejected')
              : t('admin-pages.accommodations.reviews.replies.statePending');

    return <span className="rounded-full border px-2 py-0.5 text-xs">{label}</span>;
}

interface ReplyModerationRowProps {
    readonly reply: AccommodationReviewReplyAdminItem;
    readonly submitting: boolean;
    readonly onDecide: (input: { decision: ModerationDecision; reason?: string }) => void;
}

/**
 * One reply row with its review context and the approve/reject controls.
 *
 * @param props - The reply, whether a decision is in flight, and the callback.
 * @returns The row element.
 */
function ReplyModerationRow({ reply, submitting, onDecide }: ReplyModerationRowProps) {
    const { t } = useTranslations();
    const [reason, setReason] = useState('');
    const trimmed = reason.trim();

    const reviewText = reply.reviewTitle ?? reply.reviewContent;

    return (
        <li className="space-y-2 rounded-md border p-4">
            <div className="flex flex-wrap items-center gap-2">
                <ModerationStateBadge state={reply.moderationState} />
                <span className="text-muted-foreground text-xs">
                    {reply.reviewerName ??
                        t('admin-pages.accommodations.reviews.replies.anonymousReviewer')}
                </span>
                <span className="text-muted-foreground text-xs">
                    {reply.reviewAverageRating.toFixed(1)} ★
                </span>
            </div>

            <p className="text-muted-foreground text-sm">
                {reviewText ?? t('admin-pages.accommodations.reviews.replies.noReviewText')}
            </p>

            <p className="text-sm">{reply.content}</p>

            {reply.moderationReason ? (
                <p className="text-muted-foreground text-xs">
                    {t('admin-pages.accommodations.reviews.replies.reasonLabel')}:{' '}
                    {reply.moderationReason}
                </p>
            ) : null}

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <input
                    aria-label={t('admin-pages.accommodations.reviews.replies.reasonAria')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm md:w-72"
                    disabled={submitting}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={t('admin-pages.accommodations.reviews.replies.reasonPlaceholder')}
                    type="text"
                    value={reason}
                />
                <div className="flex gap-2">
                    <Button
                        disabled={submitting || reply.moderationState === 'APPROVED'}
                        onClick={() =>
                            onDecide({
                                decision: 'APPROVED',
                                reason: trimmed === '' ? undefined : trimmed
                            })
                        }
                        size="sm"
                        variant="default"
                    >
                        {t('admin-pages.accommodations.reviews.replies.approve')}
                    </Button>
                    <Button
                        disabled={submitting || reply.moderationState === 'REJECTED'}
                        onClick={() =>
                            onDecide({
                                decision: 'REJECTED',
                                reason: trimmed === '' ? undefined : trimmed
                            })
                        }
                        size="sm"
                        variant="destructive"
                    >
                        {t('admin-pages.accommodations.reviews.replies.reject')}
                    </Button>
                </div>
            </div>
        </li>
    );
}
