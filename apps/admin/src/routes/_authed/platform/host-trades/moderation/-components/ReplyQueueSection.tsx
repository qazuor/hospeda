/**
 * @file ReplyQueueSection.tsx
 * @description The BLOCKING queue (HOS-376 T-055, §6.4).
 *
 * A reply is born PENDING, so every row here is a provider who cannot answer a
 * complaint about their own business until a human clears them — on a page
 * other hosts are already reading. That is why this section renders above the
 * review queue and defaults to PENDING while the review queue defaults to
 * everything: the two piles are not the same kind of work.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    type ModerationDecision,
    useHostTradeRepliesQueue,
    useModerateHostTradeReply
} from '@/hooks/use-host-trade-moderation';
import { useTranslations } from '@/hooks/use-translations';
import { ModerationDecisionButtons } from './ModerationDecisionButtons';

const PAGE_SIZE = 20;

/**
 * Renders the pending-reply queue.
 *
 * @returns The section element.
 */
export function ReplyQueueSection() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [decidingId, setDecidingId] = useState<string | null>(null);

    const { data, isLoading, error } = useHostTradeRepliesQueue({
        page,
        pageSize: PAGE_SIZE,
        moderationState: 'PENDING'
    });
    const moderate = useModerateHostTradeReply();

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

    return (
        <section className="space-y-3">
            <div>
                <h2 className="font-semibold text-lg">
                    {t('host-trades.moderation.replies.title')}
                </h2>
                <p className="text-muted-foreground text-sm">
                    {t('host-trades.moderation.replies.help')}
                </p>
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
                    {t('host-trades.moderation.replies.empty')}
                </p>
            ) : (
                <ul className="space-y-3">
                    {items.map((reply) => (
                        <li
                            className="space-y-2 rounded-md border p-4"
                            key={reply.id}
                        >
                            <p className="text-muted-foreground text-xs">
                                {t('host-trades.moderation.replies.onReview', {
                                    id: reply.reviewId
                                })}
                            </p>
                            <p className="text-sm">{reply.content}</p>

                            {reply.reviewEditedAfterReply ? (
                                <p className="text-muted-foreground text-xs">
                                    {t('host-trades.moderation.replies.editedAfterReply')}
                                </p>
                            ) : null}

                            <ModerationDecisionButtons
                                currentState={reply.moderationState}
                                onDecide={(input) => decide(reply.id, input)}
                                submitting={decidingId === reply.id}
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
