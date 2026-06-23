/**
 * @file _authed/social/posts/$id.tsx
 * @description Admin social post detail page (SPEC-254 T-040).
 *
 * Tabs: Content | Media | Targets | Logs | Audit
 * Sticky action bar with status-gated, permission-gated transitions.
 * Promote-hashtag modal for GPT suggestions.
 * ARIA live regions for mutation feedback.
 *
 * Permission gate: SOCIAL_POST_VIEW (server-side enforced).
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDeleteSocialPost, useSocialPostDetail } from '@/hooks/use-social-posts';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';

import { PermissionEnum } from '@repo/schemas';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { PromoteHashtagModal } from './-components/PromoteHashtagModal';
import { SocialPostActionBar } from './-components/SocialPostActionBar';
import { SocialPostApprovalBadge } from './-components/SocialPostApprovalBadge';
import { SocialPostAuditTab } from './-components/SocialPostAuditTab';
import { SocialPostContentTab } from './-components/SocialPostContentTab';
import { SocialPostLogsTab } from './-components/SocialPostLogsTab';
import { SocialPostMediaTab } from './-components/SocialPostMediaTab';
import { SocialPostStatusBadge } from './-components/SocialPostStatusBadge';
import { SocialPostTargetsTab } from './-components/SocialPostTargetsTab';

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/_authed/social/posts/$id')({
    component: SocialPostDetailPage,
    loader: async ({ params }) => ({ postId: params.id }),
    errorComponent: createErrorComponent('SocialPostDetail'),
    pendingComponent: createPendingComponent()
});

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

/** Admin social post detail page. */
function SocialPostDetailPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const navigate = useNavigate();

    const { data: post, isLoading, error } = useSocialPostDetail(id);

    const canPromote = useHasPermission(PermissionEnum.SOCIAL_HASHTAG_MANAGE);
    const canArchive = useHasPermission(PermissionEnum.SOCIAL_POST_ARCHIVE);

    // Promote hashtag modal state
    const [promoteTag, setPromoteTag] = useState<string | null>(null);

    // Delete confirmation dialog state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const deleteMutation = useDeleteSocialPost();

    const handleDeleteConfirm = () => {
        deleteMutation.mutate(id, {
            onSuccess: () => {
                navigate({ to: '/social/posts' });
            },
            onSettled: () => {
                setShowDeleteDialog(false);
            }
        });
    };

    // --- Loading / Error / Not-found states ---

    if (isLoading) {
        return (
            <div
                className="space-y-4 p-6"
                data-testid="post-detail-loading"
            >
                <div className="h-8 w-64 animate-pulse rounded bg-muted" />
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="mt-6 h-64 animate-pulse rounded bg-muted" />
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="p-6 text-center"
                data-testid="post-detail-error"
            >
                <p className="font-semibold text-destructive">
                    {t('social.posts.detail.loadingError')}
                </p>
                <Link
                    to="/social/posts"
                    className="mt-4 inline-block text-primary text-sm underline"
                >
                    {t('social.posts.detail.backToList')}
                </Link>
            </div>
        );
    }

    if (!post) {
        return (
            <div
                className="p-6 text-center"
                data-testid="post-detail-not-found"
            >
                <p className="font-semibold text-lg">{t('social.posts.detail.notFound')}</p>
                <p className="mt-1 text-muted-foreground text-sm">
                    {t('social.posts.detail.notFoundDesc')}
                </p>
                <Link
                    to="/social/posts"
                    className="mt-4 inline-block text-primary text-sm underline"
                >
                    {t('social.posts.detail.backToList')}
                </Link>
            </div>
        );
    }

    const status = post.status;
    const paused = post.paused;

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.SOCIAL_POST_VIEW]}>
            <div className="flex min-h-screen flex-col pb-24">
                {/* Header */}
                <div className="space-y-1 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1
                                className="font-bold text-2xl"
                                data-testid="post-detail-title"
                            >
                                {post.title}
                            </h1>
                            <SocialPostStatusBadge status={status} />
                            <SocialPostApprovalBadge approvalStatus={post.approvalStatus} />
                            {paused && (
                                <span className="rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-600 text-xs">
                                    {t('social.posts.detail.paused')}
                                </span>
                            )}
                        </div>
                        {/* Header action button: quick archive (soft-delete) with confirmation */}
                        <div className="flex items-center gap-2">
                            {canArchive && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setShowDeleteDialog(true)}
                                    disabled={deleteMutation.isPending}
                                    data-testid="delete-btn"
                                >
                                    {t('social.posts.detail.delete.label')}
                                </Button>
                            )}
                        </div>
                    </div>
                    <Link
                        to="/social/posts"
                        className="text-muted-foreground text-sm hover:text-primary"
                    >
                        {t('social.posts.detail.backToList')}
                    </Link>
                </div>

                {/* Tabs */}
                <div className="flex-1 px-6 pb-4">
                    <Tabs
                        defaultValue="content"
                        data-testid="post-detail-tabs"
                    >
                        <TabsList>
                            <TabsTrigger
                                value="content"
                                data-testid="tab-content"
                            >
                                {t('social.posts.detail.tabs.content')}
                            </TabsTrigger>
                            <TabsTrigger
                                value="media"
                                data-testid="tab-media"
                            >
                                {t('social.posts.detail.tabs.media')}
                            </TabsTrigger>
                            <TabsTrigger
                                value="targets"
                                data-testid="tab-targets"
                            >
                                {t('social.posts.detail.tabs.targets')}
                            </TabsTrigger>
                            <TabsTrigger
                                value="logs"
                                data-testid="tab-logs"
                            >
                                {t('social.posts.detail.tabs.logs')}
                            </TabsTrigger>
                            <TabsTrigger
                                value="audit"
                                data-testid="tab-audit"
                            >
                                {t('social.posts.detail.tabs.audit')}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="content">
                            <SocialPostContentTab
                                post={post}
                                canPromote={canPromote}
                                onPromote={setPromoteTag}
                            />
                        </TabsContent>

                        <TabsContent value="media">
                            <SocialPostMediaTab media={post.media} />
                        </TabsContent>

                        <TabsContent value="targets">
                            <SocialPostTargetsTab targets={post.targets} />
                        </TabsContent>

                        <TabsContent value="logs">
                            <SocialPostLogsTab logs={post.publishLogs} />
                        </TabsContent>

                        <TabsContent value="audit">
                            <SocialPostAuditTab postId={id} />
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Sticky action bar (includes ARIA live regions + dialogs) */}
                <SocialPostActionBar
                    postId={id}
                    postTitle={post.title}
                    status={status}
                    paused={paused}
                />

                {/* Promote-hashtag modal */}
                {promoteTag !== null && (
                    <PromoteHashtagModal
                        postId={id}
                        hashtag={promoteTag}
                        open={true}
                        onClose={() => setPromoteTag(null)}
                    />
                )}

                {/* Delete (archive) confirmation dialog */}
                <AlertDialog
                    open={showDeleteDialog}
                    onOpenChange={(open) => {
                        if (!open) setShowDeleteDialog(false);
                    }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {t('social.posts.detail.delete.confirmTitle')}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('social.posts.detail.delete.confirmDesc')}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel
                                onClick={() => setShowDeleteDialog(false)}
                                disabled={deleteMutation.isPending}
                            >
                                {t('social.posts.detail.delete.cancel')}
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteConfirm}
                                disabled={deleteMutation.isPending}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                data-testid="delete-confirm-btn"
                            >
                                {deleteMutation.isPending
                                    ? t('social.posts.detail.delete.deleting')
                                    : t('social.posts.detail.delete.confirm')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </RoutePermissionGuard>
    );
}
