/**
 * Post Gallery Tab Route (HOS-390)
 *
 * Relational-gallery counterpart of `gastronomies/$id_.gallery.tsx`, for posts.
 * The `post_media` table is the source of truth for post photos; the old
 * `media.featuredImage` / `media.gallery` fields were removed from the edit
 * form (the whole `media` section was removed from post-consolidated.config.ts).
 */

import { createFileRoute } from '@tanstack/react-router';
import { PageTabs, postTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { ContentGalleryManager } from '@/features/content-media';
import { usePostQuery } from '@/features/posts/hooks/usePostQuery';

export const Route = createFileRoute('/_authed/posts/$id_/gallery')({
    component: PostGalleryPage
});

function PostGalleryPage() {
    const { id } = Route.useParams();
    // Reuses the shared detail query cache key (also hit by the view/edit
    // routes) so navigating between tabs does not trigger a second fetch.
    //
    // This query runs IN PARALLEL with ContentGalleryManager's own media-list
    // query and can settle later. `isLoading` is threaded through as
    // `isEntityLoading` so the manager's loading gate covers BOTH — otherwise
    // the upload controls could render before `title` resolves, producing an
    // upload with no `alt` at all (there is no update-media endpoint to
    // backfill it afterwards).
    const { data: post, isLoading: isPostLoading } = usePostQuery(id);

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.postsView">
            <div className="space-y-4">
                <PageTabs
                    tabs={postTabs}
                    basePath={`/posts/${id}`}
                />

                <div className="rounded-lg border bg-card p-6">
                    <ContentGalleryManager
                        entity="post"
                        entityId={id}
                        entityName={post?.title}
                        isEntityLoading={isPostLoading}
                    />
                </div>
            </div>
        </SidebarPageLayout>
    );
}
