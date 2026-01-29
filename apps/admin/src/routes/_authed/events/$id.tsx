/**
 * Event Detail Page Route
 *
 * Displays event information with tabs for tickets and attendees.
 */

import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { PageTabs, eventTabs } from '@/components/layout/PageTabs';
import { useEventPage } from '@/features/events/hooks/useEventPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/$id')({
    component: EventViewPage,
    loader: async ({ params }) => ({ eventId: params.id }),
    errorComponent: createErrorComponent('Event'),
    pendingComponent: createPendingComponent()
});

function EventViewPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useEventPage(id);

    return (
        <div className="space-y-4">
            <PageTabs
                tabs={eventTabs}
                basePath={`/events/${id}`}
            />

            <EntityPageBase
                entityType="event"
                entityId={id}
                initialMode="view"
                entityData={entityData}
            >
                <EntityViewContent
                    entityType="event"
                    entityId={id}
                    sections={entityData.sections}
                    entity={entityData.entity || {}}
                    userPermissions={entityData.userPermissions}
                />
            </EntityPageBase>
        </div>
    );
}
