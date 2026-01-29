import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { useEventLocationPage } from '@/features/event-locations/hooks/useEventLocationPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Event Location Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/events/locations/$id_/edit')({
    component: EventLocationEditPage,
    loader: async ({ params }) => ({ eventLocationId: params.id }),
    errorComponent: createErrorComponent('EventLocation'),
    pendingComponent: createPendingComponent()
});

/**
 * Event Location Edit Page Component
 */
function EventLocationEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useEventLocationPage(id);

    return (
        <div className="space-y-4">
            <EntityPageBase
                entityType="event-location"
                entityId={id}
                initialMode="edit"
                entityData={entityData}
            >
                <EntityEditContent entityType="event-location" />
            </EntityPageBase>
        </div>
    );
}
