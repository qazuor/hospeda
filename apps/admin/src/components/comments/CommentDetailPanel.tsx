/**
 * @file CommentDetailPanel.tsx
 * @description Admin comment detail panel for SPEC-165 T-018.
 *
 * Displays full comment content, author info, entity info, metadata,
 * and all moderation action buttons:
 *   - Approve / Reject (PATCH moderationState)
 *   - Soft-delete (DELETE)
 *   - Restore (POST restore — only when deletedAt is set)
 *   - Hard-delete (DELETE hard — with AlertDialog confirmation)
 *
 * Uses the shared mutation hooks from use-comment-moderation.ts; each
 * mutation's onSuccess invalidates the list query cache.
 */

import { DeleteConfirmDialog } from '@/components/entity-form/fields/DeleteConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    useHardDeleteComment,
    useModerateComment,
    useRestoreComment,
    useSoftDeleteComment
} from '@/hooks/use-comment-moderation';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import type { EntityCommentAdminItem } from '@repo/schemas';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ModerationStateBadge } from './ModerationStateBadge';

/** Props for {@link CommentDetailPanel}. */
export interface CommentDetailPanelProps {
    /** The comment to display. */
    readonly comment: EntityCommentAdminItem;
}

/** Format a date for display. */
function formatDate(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

/**
 * Renders the full detail panel for a single comment.
 * Handles all moderation actions inline.
 *
 * @param props - {@link CommentDetailPanelProps}
 */
export function CommentDetailPanel({ comment }: CommentDetailPanelProps) {
    const { t } = useTranslations();
    const navigate = useNavigate();
    const [hardDeleteOpen, setHardDeleteOpen] = useState(false);

    const moderateMutation = useModerateComment();
    const softDeleteMutation = useSoftDeleteComment();
    const hardDeleteMutation = useHardDeleteComment();
    const restoreMutation = useRestoreComment();

    const isDeleted = !!comment.deletedAt;
    const isActionPending =
        moderateMutation.isPending ||
        softDeleteMutation.isPending ||
        hardDeleteMutation.isPending ||
        restoreMutation.isPending;

    const handleHardDelete = () => {
        hardDeleteMutation.mutate(comment.id, {
            onSuccess: () => {
                setHardDeleteOpen(false);
                navigate({ to: '/comments' });
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    variant="outline"
                    disabled={isActionPending || comment.moderationState === 'APPROVED'}
                    onClick={() =>
                        moderateMutation.mutate({ id: comment.id, moderationState: 'APPROVED' })
                    }
                    data-testid="detail-approve-btn"
                >
                    {t('comments.actions.approve')}
                </Button>
                <Button
                    variant="outline"
                    disabled={isActionPending || comment.moderationState === 'REJECTED'}
                    onClick={() =>
                        moderateMutation.mutate({ id: comment.id, moderationState: 'REJECTED' })
                    }
                    data-testid="detail-reject-btn"
                >
                    {t('comments.actions.reject')}
                </Button>
                <Button
                    variant="outline"
                    disabled={isActionPending || isDeleted}
                    onClick={() => softDeleteMutation.mutate(comment.id)}
                    data-testid="detail-delete-btn"
                >
                    {t('comments.actions.delete')}
                </Button>
                {isDeleted && (
                    <Button
                        variant="outline"
                        disabled={isActionPending}
                        onClick={() => restoreMutation.mutate(comment.id)}
                        data-testid="detail-restore-btn"
                    >
                        {t('comments.actions.restore')}
                    </Button>
                )}
                <Button
                    variant="destructive"
                    disabled={isActionPending}
                    onClick={() => setHardDeleteOpen(true)}
                    data-testid="detail-hard-delete-btn"
                >
                    {t('comments.actions.hardDelete')}
                </Button>
            </div>

            {/* Full content */}
            <Card className="p-4">
                <h2 className="mb-2 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                    {t('comments.detail.contentHeading' as TranslationKey)}
                </h2>
                <p className="whitespace-pre-wrap text-base">{comment.content}</p>
            </Card>

            {/* Author info */}
            <Card className="p-4">
                <h2 className="mb-3 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                    {t('comments.detail.authorHeading' as TranslationKey)}
                </h2>
                <div className="space-y-1 text-sm">
                    <div>
                        <span className="font-medium">
                            {t('comments.detail.authorName' as TranslationKey)}{' '}
                        </span>
                        {comment.authorId ? (
                            <Link
                                to="/access/users/$id"
                                params={{ id: comment.authorId }}
                                className="text-primary hover:underline"
                                data-testid="author-link"
                            >
                                {comment.authorName}
                            </Link>
                        ) : (
                            <span className="text-muted-foreground">{comment.authorName}</span>
                        )}
                    </div>
                    {!comment.authorId && (
                        <p className="text-muted-foreground text-xs">
                            {t('comments.detail.deletedUserNote' as TranslationKey)}
                        </p>
                    )}
                </div>
            </Card>

            {/* Entity info */}
            <Card className="p-4">
                <h2 className="mb-3 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                    {t('comments.detail.entityHeading' as TranslationKey)}
                </h2>
                <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="font-medium">
                            {t('comments.detail.entityType' as TranslationKey)}
                        </span>
                        <Badge variant="secondary">{comment.entityType}</Badge>
                    </div>
                    <div>
                        <span className="font-medium">
                            {t('comments.detail.entityId' as TranslationKey)}{' '}
                        </span>
                        {comment.entityType === 'POST' ? (
                            <Link
                                to="/posts/$id"
                                params={{ id: comment.entityId }}
                                className="font-mono text-primary text-xs hover:underline"
                                data-testid="entity-link"
                            >
                                {comment.entityId}
                            </Link>
                        ) : comment.entityType === 'EVENT' ? (
                            <Link
                                to="/events/$id"
                                params={{ id: comment.entityId }}
                                className="font-mono text-primary text-xs hover:underline"
                                data-testid="entity-link"
                            >
                                {comment.entityId}
                            </Link>
                        ) : (
                            <span className="font-mono text-xs">{comment.entityId}</span>
                        )}
                    </div>
                </div>
            </Card>

            {/* Metadata */}
            <Card className="p-4">
                <h2 className="mb-3 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                    {t('comments.detail.metadataHeading' as TranslationKey)}
                </h2>
                <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="font-medium">
                            {t('comments.detail.state' as TranslationKey)}
                        </span>
                        <ModerationStateBadge state={comment.moderationState} />
                    </div>
                    <div>
                        <span className="font-medium">
                            {t('comments.detail.createdAt' as TranslationKey)}{' '}
                        </span>
                        <span className="text-muted-foreground">
                            {formatDate(comment.createdAt)}
                        </span>
                    </div>
                    <div>
                        <span className="font-medium">
                            {t('comments.detail.updatedAt' as TranslationKey)}{' '}
                        </span>
                        <span className="text-muted-foreground">
                            {formatDate(comment.updatedAt)}
                        </span>
                    </div>
                    {isDeleted && (
                        <div>
                            <span className="font-medium text-destructive">
                                {t('comments.detail.deletedAt' as TranslationKey)}{' '}
                            </span>
                            <span className="text-muted-foreground">
                                {formatDate(comment.deletedAt)}
                            </span>
                        </div>
                    )}
                </div>
            </Card>

            {/* Hard-delete confirmation dialog */}
            <DeleteConfirmDialog
                open={hardDeleteOpen}
                onOpenChange={setHardDeleteOpen}
                title={t('comments.detail.hardDeleteTitle' as TranslationKey)}
                description={t('comments.detail.hardDeleteDescription' as TranslationKey)}
                cancelLabel={t('comments.detail.hardDeleteCancel' as TranslationKey)}
                confirmLabel={t('comments.actions.hardDelete')}
                onConfirm={handleHardDelete}
            />
        </div>
    );
}
