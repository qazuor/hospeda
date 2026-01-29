/**
 * Post Detail Page Route
 *
 * Displays post content with tabs for SEO and sponsorship.
 */

import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { PageTabs, postTabs } from '@/components/layout/PageTabs';
import { usePostPage } from '@/features/posts/hooks/usePostPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/posts/$id')({
    component: PostViewPage,
    loader: async ({ params }) => ({ postId: params.id }),
    errorComponent: createErrorComponent('Post'),
    pendingComponent: createPendingComponent()
});

function PostViewPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = usePostPage(id);

    return (
        <div className="space-y-4">
            <PageTabs
                tabs={postTabs}
                basePath={`/posts/${id}`}
            />

            <EntityPageBase
                entityType="post"
                entityId={id}
                initialMode="view"
                entityData={entityData}
            >
                <EntityViewContent
                    entityType="post"
                    entityId={id}
                    sections={entityData.sections}
                    entity={entityData.entity || {}}
                    userPermissions={entityData.userPermissions}
                />
            </EntityPageBase>
        </div>
    );
}
