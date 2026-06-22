/**
 * @file QuickApprovalQueue.tsx
 * @description Quick-approval queue section for the social dashboard (SPEC-254 T-041).
 *
 * Lists posts in NEEDS_REVIEW with an inline optimistic approve action.
 * Approved items are removed from the visible queue immediately via the
 * optimistic cache update in `useApproveSocialPost`.
 */

import { Button } from '@/components/ui/button';
import { useApproveSocialPost } from '@/hooks/use-social-posts';
import { socialPostQueryKeys } from '@/hooks/use-social-posts';
import { useTranslations } from '@/hooks/use-translations';
import { SocialPostPlatformIcons } from '@/routes/_authed/social/posts/-components/SocialPostPlatformIcons';
import type { TranslationKey } from '@repo/i18n';
import type { SocialDashboardQueueItem, SocialDashboardResponse } from '@repo/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

/** Props for {@link QuickApprovalQueue}. */
export interface QuickApprovalQueueProps {
    readonly items: readonly SocialDashboardQueueItem[];
}

/** Stable keys for the loading skeleton rows. */
const SKELETON_KEYS = ['qaq-sk-1', 'qaq-sk-2', 'qaq-sk-3'] as const;

/**
 * Renders the quick-approval queue section.
 *
 * Each item shows title, platforms, and an approve button. Clicking approve
 * optimistically removes the item from the dashboard cache and fires the
 * approve API call. On error the item reappears via rollback.
 *
 * @param props - {@link QuickApprovalQueueProps}
 */
export function QuickApprovalQueue({ items }: QuickApprovalQueueProps) {
    const { t } = useTranslations();
    const queryClient = useQueryClient();
    const approveMutation = useApproveSocialPost();

    const handleApprove = (id: string) => {
        // Optimistically remove the item from the dashboard queue cache.
        queryClient.setQueryData<SocialDashboardResponse>(
            socialPostQueryKeys.dashboard(),
            (old) => {
                if (!old) return old;
                return {
                    ...old,
                    quickApprovalQueue: old.quickApprovalQueue.filter((item) => item.id !== id),
                    kpis: {
                        ...old.kpis,
                        pendingReview: Math.max(0, old.kpis.pendingReview - 1)
                    }
                };
            }
        );

        approveMutation.mutate(id, {
            onError: () => {
                // Rollback by invalidating so the dashboard refetches its real state.
                queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.dashboard() });
            }
        });
    };

    if (items.length === 0) {
        return (
            <section
                className="space-y-3"
                data-testid="approval-queue-section"
            >
                <h2 className="font-semibold text-lg">
                    {t('social.dashboard.approvalQueue.title' as TranslationKey)}
                </h2>
                <p
                    className="text-muted-foreground text-sm"
                    data-testid="approval-queue-empty"
                >
                    {t('social.dashboard.approvalQueue.empty' as TranslationKey)}
                </p>
            </section>
        );
    }

    return (
        <section
            className="space-y-3"
            data-testid="approval-queue-section"
        >
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">
                    {t('social.dashboard.approvalQueue.title' as TranslationKey)}
                </h2>
                <Link
                    to="/social/posts"
                    search={{ status: 'NEEDS_REVIEW', approvalStatus: 'PENDING' }}
                    className="text-primary text-sm hover:underline"
                    data-testid="approval-queue-view-all"
                >
                    {t('social.dashboard.approvalQueue.viewAll' as TranslationKey)}
                </Link>
            </div>

            <ul className="space-y-2">
                {items.map((item) => (
                    <QueueItem
                        key={item.id}
                        item={item}
                        isApproving={
                            approveMutation.isPending && approveMutation.variables === item.id
                        }
                        onApprove={handleApprove}
                    />
                ))}
            </ul>
        </section>
    );
}

/** Loading skeleton for the approval queue section. */
export function QuickApprovalQueueSkeleton() {
    return (
        <section
            className="space-y-3"
            data-testid="approval-queue-skeleton"
        >
            <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
            <ul className="space-y-2">
                {SKELETON_KEYS.map((k) => (
                    <li
                        key={k}
                        className="h-14 animate-pulse rounded-md bg-muted"
                    />
                ))}
            </ul>
        </section>
    );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface QueueItemProps {
    readonly item: SocialDashboardQueueItem;
    readonly isApproving: boolean;
    readonly onApprove: (id: string) => void;
}

function QueueItem({ item, isApproving, onApprove }: QueueItemProps) {
    const { t } = useTranslations();

    return (
        <li
            className="flex items-center gap-3 rounded-md border bg-card p-3"
            data-testid={`queue-item-${item.id}`}
        >
            {item.thumbnailUrl != null && (
                <img
                    src={item.thumbnailUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                    aria-hidden="true"
                />
            )}
            <div className="min-w-0 flex-1">
                <Link
                    to="/social/posts/$id"
                    params={{ id: item.id }}
                    className="truncate font-medium text-sm hover:underline"
                    data-testid={`queue-item-title-${item.id}`}
                >
                    {item.title}
                </Link>
                <div className="mt-0.5">
                    <SocialPostPlatformIcons platforms={item.platforms} />
                </div>
            </div>
            <Button
                size="sm"
                variant="default"
                disabled={isApproving}
                onClick={() => onApprove(item.id)}
                data-testid={`queue-approve-btn-${item.id}`}
            >
                {isApproving
                    ? t('social.dashboard.approvalQueue.approving' as TranslationKey)
                    : t('social.dashboard.approvalQueue.approve' as TranslationKey)}
            </Button>
        </li>
    );
}
