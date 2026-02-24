import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { useAttractionPage } from '@/features/attractions/hooks/useAttractionPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Attraction View Route Configuration
 */
export const Route = createFileRoute('/_authed/content/destination-attractions/$id')({
    component: AttractionViewPage,
    loader: async ({ params }) => ({ attractionId: params.id }),
    errorComponent: createErrorComponent('Attraction'),
    pendingComponent: createPendingComponent()
});

/**
 * Attraction View Page Component
 */
function AttractionViewPage() {
    const { id } = Route.useParams();

    const entityData = useAttractionPage(id);

    return (
        <div className="space-y-4">
            <EntityPageBase
                entityType="attraction"
                entityId={id}
                initialMode="view"
                entityData={entityData}
            >
                <EntityViewContent
                    entityType="attraction"
                    entityId={id}
                    sections={entityData.sections}
                    entity={entityData.entity || {}}
                    userPermissions={entityData.userPermissions}
                />
            </EntityPageBase>
        </div>
    );
}
