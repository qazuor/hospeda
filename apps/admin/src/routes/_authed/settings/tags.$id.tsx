import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { useTagPage } from '@/features/tags/hooks/useTagPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Tag View Route Configuration
 */
export const Route = createFileRoute('/_authed/settings/tags/$id')({
    component: TagViewPage,
    loader: async ({ params }) => ({ tagId: params.id }),
    errorComponent: createErrorComponent('Tag'),
    pendingComponent: createPendingComponent()
});

/**
 * Tag View Page Component
 */
function TagViewPage() {
    const { id } = Route.useParams();

    // Use the hook at the top level
    const entityData = useTagPage(id);

    return (
        <EntityPageBase
            entityType="tag"
            entityId={id}
            initialMode="view"
            entityData={entityData}
        >
            <EntityViewContent
                entityType="tag"
                entityId={id}
                sections={entityData.sections}
                entity={entityData.entity || {}}
                userPermissions={entityData.userPermissions}
            />
        </EntityPageBase>
    );
}
