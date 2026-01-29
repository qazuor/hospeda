import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { useTagPage } from '@/features/tags/hooks/useTagPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Tag Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/settings/tags/$id_/edit')({
    component: TagEditPage,
    loader: async ({ params }) => ({ tagId: params.id }),
    errorComponent: createErrorComponent('Tag'),
    pendingComponent: createPendingComponent()
});

/**
 * Tag Edit Page Component
 */
function TagEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useTagPage(id);

    return (
        <EntityPageBase
            entityType="tag"
            entityId={id}
            initialMode="edit"
            entityData={entityData}
        >
            <EntityEditContent entityType="tag" />
        </EntityPageBase>
    );
}
