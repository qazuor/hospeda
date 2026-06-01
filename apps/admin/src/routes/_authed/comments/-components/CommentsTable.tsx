/**
 * @file CommentsTable.tsx
 * @description Native HTML table for the admin comment moderation queue (SPEC-165 T-017, AC-33/34).
 *
 * Renders a paginated list of EntityCommentAdminItem rows with inline
 * Approve / Reject / Soft-delete actions. Mutation success busts the list
 * cache via the shared hooks (AC-34).
 *
 * Does NOT use TanStack Table — follows the same native-table pattern as the
 * newsletter subscribers page (apps/admin/src/routes/_authed/newsletter/subscribers).
 */

import { ModerationStateBadge } from '@/components/comments/ModerationStateBadge';
import { Button } from '@/components/ui/button';
import { useModerateComment, useSoftDeleteComment } from '@/hooks/use-comment-moderation';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import type { EntityCommentAdminItem } from '@repo/schemas';
import { Link } from '@tanstack/react-router';

/** Props for {@link CommentsTable}. */
export interface CommentsTableProps {
    readonly items: EntityCommentAdminItem[];
}

/** Format a date value for display. */
function formatDate(value: string | Date | null | undefined): string {
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

/** Truncate a string to a maximum length, appending ellipsis if needed. */
function truncate(text: string, max = 80): string {
    return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/**
 * Renders the paginated comment rows with inline moderation actions.
 *
 * @param props - {@link CommentsTableProps}
 */
export function CommentsTable({ items }: CommentsTableProps) {
    const { t } = useTranslations();
    const moderateMutation = useModerateComment();
    const softDeleteMutation = useSoftDeleteComment();

    const isLoading = moderateMutation.isPending || softDeleteMutation.isPending;

    return (
        <div className="overflow-x-auto rounded-lg border bg-card">
            <table
                className="w-full text-sm"
                aria-label={t('comments.table.ariaLabel' as TranslationKey)}
            >
                <thead className="bg-muted/50 text-left">
                    <tr>
                        <th className="px-4 py-3 font-medium">
                            {t('comments.table.colEntityType' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('comments.table.colContent' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('comments.table.colAuthor' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('comments.table.colState' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('comments.table.colCreatedAt' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('comments.table.colActions' as TranslationKey)}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr
                            key={item.id}
                            className="border-t hover:bg-muted/20"
                            data-testid={`comment-row-${item.id}`}
                        >
                            {/* Entity type badge + link to detail */}
                            <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-medium text-xs uppercase">
                                        {item.entityType}
                                    </span>
                                    <Link
                                        to="/comments/$commentId"
                                        params={{ commentId: item.id }}
                                        className="text-primary text-xs hover:underline"
                                    >
                                        {t('comments.table.viewDetail' as TranslationKey)}
                                    </Link>
                                </div>
                            </td>

                            {/* Content excerpt */}
                            <td className="max-w-xs px-4 py-3 text-muted-foreground">
                                {truncate(item.content)}
                            </td>

                            {/* Author */}
                            <td className="px-4 py-3">{item.authorName}</td>

                            {/* Moderation state badge */}
                            <td className="px-4 py-3">
                                <ModerationStateBadge state={item.moderationState} />
                            </td>

                            {/* Created at */}
                            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                                {formatDate(item.createdAt)}
                            </td>

                            {/* Inline actions */}
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={isLoading || item.moderationState === 'APPROVED'}
                                        onClick={() =>
                                            moderateMutation.mutate({
                                                id: item.id,
                                                moderationState: 'APPROVED'
                                            })
                                        }
                                        data-testid={`approve-btn-${item.id}`}
                                    >
                                        {t('comments.actions.approve')}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={isLoading || item.moderationState === 'REJECTED'}
                                        onClick={() =>
                                            moderateMutation.mutate({
                                                id: item.id,
                                                moderationState: 'REJECTED'
                                            })
                                        }
                                        data-testid={`reject-btn-${item.id}`}
                                    >
                                        {t('comments.actions.reject')}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={isLoading || !!item.deletedAt}
                                        onClick={() => softDeleteMutation.mutate(item.id)}
                                        data-testid={`delete-btn-${item.id}`}
                                    >
                                        {t('comments.actions.delete')}
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
