/**
 * @file SocialPostsTable.tsx
 * @description Admin social posts list table (SPEC-254 T-039).
 *
 * Renders a paginated list of SocialPostListItem rows with:
 * - color-coded status + approval-status badges
 * - platform icon row with aria-label per icon
 * - optimistic approve action (hidden when user lacks SOCIAL_POST_APPROVE)
 *
 * Follows the same native-table pattern as CommentsTable.tsx.
 */

import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { useApproveSocialPost } from '@/hooks/use-social-posts';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import type { SocialPostListItem } from '@repo/service-core';
import { SocialPostApprovalBadge } from './SocialPostApprovalBadge';
import { SocialPostPlatformIcons } from './SocialPostPlatformIcons';
import { SocialPostStatusBadge } from './SocialPostStatusBadge';

/** Props for {@link SocialPostsTable}. */
export interface SocialPostsTableProps {
    readonly items: SocialPostListItem[];
}

/** Format a date for display, or return a dash. */
function formatDate(value: Date | string | null | undefined): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

/** Truncate a string to a max length, appending ellipsis if needed. */
function truncate(text: string, max = 60): string {
    return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/**
 * Renders the social posts list as a native HTML table with inline approve action.
 *
 * @param props - {@link SocialPostsTableProps}
 */
export function SocialPostsTable({ items }: SocialPostsTableProps) {
    const { t } = useTranslations();
    const approveMutation = useApproveSocialPost();

    return (
        <div className="overflow-x-auto rounded-lg border bg-card">
            <table
                className="w-full text-sm"
                aria-label={t('social.posts.table.ariaLabel' as TranslationKey)}
            >
                <thead className="bg-muted/50 text-left">
                    <tr>
                        <th className="px-4 py-3 font-medium">
                            {t('social.posts.table.colTitle' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.posts.table.colStatus' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.posts.table.colApprovalStatus' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.posts.table.colPlatforms' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.posts.table.colScheduledAt' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.posts.table.colActions' as TranslationKey)}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((post) => (
                        <tr
                            key={post.id}
                            className="border-t hover:bg-muted/20"
                            data-testid={`post-row-${post.id}`}
                        >
                            {/* Title */}
                            <td className="max-w-xs px-4 py-3 font-medium">
                                {truncate(post.title)}
                            </td>

                            {/* Pipeline status */}
                            <td className="px-4 py-3">
                                <SocialPostStatusBadge status={post.status} />
                            </td>

                            {/* Approval status */}
                            <td className="px-4 py-3">
                                <SocialPostApprovalBadge approvalStatus={post.approvalStatus} />
                            </td>

                            {/* Platforms icon row */}
                            <td className="px-4 py-3">
                                <SocialPostPlatformIcons platforms={post.platforms} />
                            </td>

                            {/* Scheduled at */}
                            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                                {post.scheduledAt
                                    ? formatDate(post.scheduledAt)
                                    : t('social.posts.table.noScheduled' as TranslationKey)}
                            </td>

                            {/* Actions — approve button gated by permission */}
                            <td className="px-4 py-3">
                                <PermissionGate permissions={[PermissionEnum.SOCIAL_POST_APPROVE]}>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                            approveMutation.isPending ||
                                            post.approvalStatus === 'APPROVED'
                                        }
                                        onClick={() => approveMutation.mutate(post.id)}
                                        data-testid={`approve-btn-${post.id}`}
                                    >
                                        {approveMutation.isPending &&
                                        approveMutation.variables === post.id
                                            ? t('social.posts.actions.approving' as TranslationKey)
                                            : t('social.posts.actions.approve' as TranslationKey)}
                                    </Button>
                                </PermissionGate>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
