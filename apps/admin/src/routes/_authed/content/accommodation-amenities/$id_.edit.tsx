import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { useAmenityPage } from '@/features/amenities/hooks/useAmenityPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Amenity Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/content/accommodation-amenities/$id_/edit')({
    component: AmenityEditPage,
    loader: async ({ params }) => ({ amenityId: params.id }),
    errorComponent: createErrorComponent('Amenity'),
    pendingComponent: createPendingComponent()
});

/**
 * Amenity Edit Page Component
 */
function AmenityEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useAmenityPage(id);

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.AMENITY_UPDATE]}>
            <EntityPageBase
                entityType="amenity"
                entityId={id}
                initialMode="edit"
                entityData={entityData}
            >
                <EntityEditContent entityType="amenity" />
            </EntityPageBase>
        </RoutePermissionGuard>
    );
}
