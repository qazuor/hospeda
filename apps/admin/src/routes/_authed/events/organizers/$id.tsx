/**
 * Event Organizer Detail Page Route
 *
 * Displays event organizer information with tabs for related events and contact.
 */

import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { PageTabs, eventOrganizerTabs } from '@/components/layout/PageTabs';
import { useEventOrganizerPage } from '@/features/event-organizers/hooks/useEventOrganizerPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/organizers/$id')({
    component: EventOrganizerViewPage,
    loader: async ({ params }) => ({ eventOrganizerId: params.id }),
    errorComponent: createErrorComponent('EventOrganizer'),
    pendingComponent: createPendingComponent()
});

function EventOrganizerViewPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useEventOrganizerPage(id);

    return (
        <div className="space-y-4">
            <PageTabs
                tabs={eventOrganizerTabs}
                basePath={`/events/organizers/${id}`}
            />

            <EntityPageBase
                entityType="event-organizer"
                entityId={id}
                initialMode="view"
                entityData={entityData}
            >
                <EntityViewContent
                    entityType="event-organizer"
                    entityId={id}
                    sections={entityData.sections}
                    entity={entityData.entity || {}}
                    userPermissions={entityData.userPermissions}
                />
            </EntityPageBase>
        </div>
    );
}
