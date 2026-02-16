import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { useFeaturePage } from '@/features/features/hooks/useFeaturePage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Feature View Route Configuration
 */
export const Route = createFileRoute('/_authed/content/accommodation-features/$id')({
    component: FeatureViewPage,
    loader: async ({ params }) => ({ featureId: params.id }),
    errorComponent: createErrorComponent('Feature'),
    pendingComponent: createPendingComponent()
});

/**
 * Feature View Page Component
 */
function FeatureViewPage() {
    const { id } = Route.useParams();

    // Use the hook at the top level
    const entityData = useFeaturePage(id);

    return (
        <EntityPageBase
            entityType="feature"
            entityId={id}
            initialMode="view"
            entityData={entityData}
        >
            <EntityViewContent
                entityType="feature"
                entityId={id}
                sections={entityData.sections}
                entity={entityData.entity || {}}
                userPermissions={entityData.userPermissions}
            />
        </EntityPageBase>
    );
}
