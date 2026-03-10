import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { useFeaturePage } from '@/features/features/hooks/useFeaturePage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { FeatureUpdateInputSchema, PermissionEnum } from '@repo/schemas';
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
        <RoutePermissionGuard permissions={[PermissionEnum.FEATURE_UPDATE]}>
            <EntityPageBase
                entityType="feature"
                entityId={id}
                initialMode="edit"
                entityData={entityData}
                zodSchema={FeatureUpdateInputSchema}
            >
                <EntityEditContent entityType="feature" />
            </EntityPageBase>
        </RoutePermissionGuard>
    );
}
