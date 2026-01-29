import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { useEventOrganizerPage } from '@/features/event-organizers/hooks/useEventOrganizerPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Event Organizer Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/events/organizers/$id_/edit')({
    component: EventOrganizerEditPage,
    loader: async ({ params }) => ({ eventOrganizerId: params.id }),
    errorComponent: createErrorComponent('EventOrganizer'),
    pendingComponent: createPendingComponent()
});

/**
 * Event Organizer Edit Page Component
 */
function EventOrganizerEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useEventOrganizerPage(id);

    return (
        <div className="space-y-4">
            <EntityPageBase
                entityType="event-organizer"
                entityId={id}
                initialMode="edit"
                entityData={entityData}
            >
                <EntityEditContent entityType="event-organizer" />
            </EntityPageBase>
        </div>
    );
}
