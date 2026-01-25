import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { useAccommodationPage } from '@/features/accommodations/hooks/useAccommodationPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Accommodation View Route Configuration
 */
export const Route = createFileRoute('/_authed/accommodations/$id')({
    component: AccommodationViewPage,
    loader: async ({ params }) => ({ accommodationId: params.id }),
    errorComponent: createErrorComponent('Accommodation'),
    pendingComponent: createPendingComponent()
});

/**
 * Accommodation View Page Component
 */
function AccommodationViewPage() {
    const { id } = Route.useParams();

    // Use the hook at the top level
    const entityData = useAccommodationPage(id);

    return (
        <EntityPageBase
            entityType="accommodation"
            entityId={id}
            initialMode="view"
            entityData={entityData}
        >
            <EntityViewContent
                entityType="accommodation"
                entityId={id}
                sections={entityData.sections}
                entity={entityData.entity || {}}
                userPermissions={entityData.userPermissions}
            />
        </EntityPageBase>
    );
}
