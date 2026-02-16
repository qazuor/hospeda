import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { useAmenityPage } from '@/features/amenities/hooks/useAmenityPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Amenity View Route Configuration
 */
export const Route = createFileRoute('/_authed/content/accommodation-amenities/$id')({
    component: AmenityViewPage,
    loader: async ({ params }) => ({ amenityId: params.id }),
    errorComponent: createErrorComponent('Amenity'),
    pendingComponent: createPendingComponent()
});

/**
 * Amenity View Page Component
 */
function AmenityViewPage() {
    const { id } = Route.useParams();

    // Use the hook at the top level
    const entityData = useAmenityPage(id);

    return (
        <EntityPageBase
            entityType="amenity"
            entityId={id}
            initialMode="view"
            entityData={entityData}
        >
            <EntityViewContent
                entityType="amenity"
                entityId={id}
                sections={entityData.sections}
                entity={entityData.entity || {}}
                userPermissions={entityData.userPermissions}
            />
        </EntityPageBase>
    );
}
