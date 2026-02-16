import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { useFeaturePage } from '@/features/features/hooks/useFeaturePage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Feature Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/content/accommodation-features/$id_/edit')({
    component: FeatureEditPage,
    loader: async ({ params }) => ({ featureId: params.id }),
    errorComponent: createErrorComponent('Feature'),
    pendingComponent: createPendingComponent()
});

/**
 * Feature Edit Page Component
 */
function FeatureEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useFeaturePage(id);

    return (
        <EntityPageBase
            entityType="feature"
            entityId={id}
            initialMode="edit"
            entityData={entityData}
        >
            <EntityEditContent entityType="feature" />
        </EntityPageBase>
    );
}
