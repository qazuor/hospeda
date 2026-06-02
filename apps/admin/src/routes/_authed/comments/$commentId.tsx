/**
 * @file _authed/comments/$commentId.tsx
 * @description Admin comment detail page (SPEC-165 T-018).
 *
 * Displays full comment details with all moderation actions. Protected by
 * POST_COMMENT_VIEW OR EVENT_COMMENT_VIEW (OR semantics).
 *
 * Uses useComment(id) from use-comment-moderation.ts to fetch the comment.
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { CommentDetailPanel } from '@/components/comments/CommentDetailPanel';
import { Button } from '@/components/ui/button';
import { useComment } from '@/hooks/use-comment-moderation';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import { Link, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/comments/$commentId')({
    component: CommentDetailPage,
    errorComponent: createErrorComponent('CommentDetail'),
    pendingComponent: createPendingComponent()
});

/** Comment detail page. */
function CommentDetailPage() {
    const { t } = useTranslations();
    const { commentId } = Route.useParams();
    const { data: comment, isLoading, error } = useComment(commentId);

    return (
        <RoutePermissionGuard
            permissions={[PermissionEnum.POST_COMMENT_VIEW, PermissionEnum.EVENT_COMMENT_VIEW]}
        >
            <div className="space-y-6 p-6">
                {/* Header with back link */}
                <div className="flex items-center gap-3">
                    <Link to="/comments">
                        <Button
                            variant="outline"
                            size="sm"
                        >
                            {t('comments.detail.backToList' as TranslationKey)}
                        </Button>
                    </Link>
                    <h1 className="font-bold text-2xl">
                        {t('comments.detail.title' as TranslationKey)}
                    </h1>
                </div>

                {/* Loading */}
                {isLoading && (
                    <p className="text-muted-foreground text-sm">
                        {t('comments.detail.loading' as TranslationKey)}
                    </p>
                )}

                {/* Error */}
                {error && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                    >
                        {t('comments.detail.error' as TranslationKey)}
                    </p>
                )}

                {/* Not found */}
                {!isLoading && !error && !comment && (
                    <div className="py-16 text-center text-muted-foreground">
                        <p>{t('comments.detail.notFound' as TranslationKey)}</p>
                        <Link to="/comments">
                            <Button
                                variant="outline"
                                className="mt-4"
                            >
                                {t('comments.detail.backToListShort' as TranslationKey)}
                            </Button>
                        </Link>
                    </div>
                )}

                {/* Detail panel */}
                {!isLoading && !error && comment && <CommentDetailPanel comment={comment} />}
            </div>
        </RoutePermissionGuard>
    );
}
