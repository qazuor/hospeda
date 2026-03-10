import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { usePostPage } from '@/features/posts/hooks/usePostPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum, PostUpdateInputSchema } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Post Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/posts/$id_/edit')({
    component: PostEditPage,
    loader: async ({ params }) => ({ postId: params.id }),
    errorComponent: createErrorComponent('Post'),
    pendingComponent: createPendingComponent()
});

/**
 * Post Edit Page Component
 */
function PostEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = usePostPage(id);

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.POST_UPDATE]}>
            <div className="space-y-4">
                <EntityPageBase
                    entityType="post"
                    entityId={id}
                    initialMode="edit"
                    entityData={entityData}
                    zodSchema={PostUpdateInputSchema}
                >
                    <EntityEditContent entityType="post" />
                </EntityPageBase>
            </div>
        </RoutePermissionGuard>
    );
}
