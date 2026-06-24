/**
 * @file _authed/social/posts/$id.tsx
 * @description Admin social post detail page — hybrid 2-column layout (SPEC-254 T-040).
 *
 * Layout:
 *   Header (full width)
 *     Back link + title + status/approval badges
 *   Body (2 columns)
 *     Left (~2/3): SocialPostPreviewCard (image + caption + hashtags)
 *                  + secondary tabs: Details / Targets / Logs / Audit
 *     Right (~1/3): SocialPostSidePanel (metadata card + actions card)
 *
 * The SocialPostSidePanel owns all mutation state, replacing the old
 * SocialPostActionBar (sticky bottom bar). The PromoteHashtagModal and the
 * delete confirmation dialog are retained from the original implementation.
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
import { SocialPostApprovalBadge } from './-components/SocialPostApprovalBadge';
import { SocialPostAuditTab } from './-components/SocialPostAuditTab';
import { SocialPostDetailsTab } from './-components/SocialPostDetailsTab';
import { SocialPostLogsTab } from './-components/SocialPostLogsTab';
import { SocialPostPreviewCard } from './-components/SocialPostPreviewCard';
import { SocialPostSidePanel } from './-components/SocialPostSidePanel';
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

/** Admin social post detail page — hybrid 2-column layout. */
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
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-8 w-64 animate-pulse rounded bg-muted" />
                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="col-span-2 h-96 animate-pulse rounded-xl bg-muted" />
                    <div className="h-64 animate-pulse rounded-xl bg-muted" />
                </div>
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

    const { status, paused } = post;

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.SOCIAL_POST_VIEW]}>
            <div className="flex flex-col gap-6 p-6 pb-10">
                {/* ── HEADER (full width) ─────────────────────────────────── */}
                <div className="space-y-2">
                    {/* Back link */}
                    <Link
                        to="/social/posts"
                        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-primary"
                    >
                        ← {t('social.posts.detail.backToList')}
                    </Link>

                    {/* Title + badges row */}
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

                        {/* Quick archive button (hard delete from header) */}
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

                {/* ── BODY: 2-column grid ─────────────────────────────────── */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* Preview column (~1/3) */}
                    <div className="lg:col-span-4">
                        {/* Visual preview card */}
                        <SocialPostPreviewCard
                            media={post.media}
                            captionBase={post.captionBase}
                            finalCaption={post.finalCaption}
                            finalHashtagsText={post.finalHashtagsText}
                            hashtags={post.hashtags}
                            canPromote={canPromote}
                            gptHashtagPayloadJson={post.gptHashtagPayloadJson}
                            onPromote={setPromoteTag}
                        />
                    </div>

                    {/* Tabs column (~5/12) */}
                    <div className="min-w-0 lg:col-span-5">
                        {/* Secondary tabs */}
                        <Tabs
                            defaultValue="details"
                            data-testid="post-detail-secondary-tabs"
                        >
                            <TabsList>
                                <TabsTrigger
                                    value="details"
                                    data-testid="tab-details"
                                >
                                    {t('social.posts.detail.secondaryTabs.details')}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="targets"
                                    data-testid="tab-targets"
                                >
                                    {t('social.posts.detail.secondaryTabs.targets')}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="logs"
                                    data-testid="tab-logs"
                                >
                                    {t('social.posts.detail.secondaryTabs.logs')}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="audit"
                                    data-testid="tab-audit"
                                >
                                    {t('social.posts.detail.secondaryTabs.audit')}
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="details">
                                <SocialPostDetailsTab post={post} />
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

                    {/* Side panel column (~1/4) */}
                    <div className="lg:col-span-3">
                        <SocialPostSidePanel
                            postId={id}
                            postTitle={post.title}
                            status={status}
                            approvalStatus={post.approvalStatus}
                            paused={paused}
                            scheduledAt={post.scheduledAt}
                            targets={post.targets}
                            batch={post.batch}
                            campaign={post.campaign}
                            recurrenceType={post.recurrenceType}
                            nextRunAt={post.nextRunAt}
                            recurrenceParamsJson={post.recurrenceParamsJson}
                        />
                    </div>
                </div>
            </div>

            {/* ── MODALS ──────────────────────────────────────────────────── */}

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
        </RoutePermissionGuard>
    );
}
