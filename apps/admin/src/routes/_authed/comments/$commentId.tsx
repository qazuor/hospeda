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
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { Link, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/comments/$commentId')({
    component: CommentDetailPage,
    errorComponent: createErrorComponent('CommentDetail'),
    pendingComponent: createPendingComponent()
});

/** Comment detail page. */
function CommentDetailPage() {
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
                            ← Volver a comentarios
                        </Button>
                    </Link>
                    <h1 className="font-bold text-2xl">Detalle del comentario</h1>
                </div>

                {/* Loading */}
                {isLoading && <p className="text-muted-foreground text-sm">Cargando comentario…</p>}

                {/* Error */}
                {error && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                    >
                        Error al cargar el comentario. Intentá de nuevo.
                    </p>
                )}

                {/* Not found */}
                {!isLoading && !error && !comment && (
                    <div className="py-16 text-center text-muted-foreground">
                        <p>Comentario no encontrado.</p>
                        <Link to="/comments">
                            <Button
                                variant="outline"
                                className="mt-4"
                            >
                                Volver a la lista
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
