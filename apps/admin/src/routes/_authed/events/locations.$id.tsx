/**
 * Event Location Detail Page Route
 *
 * Displays event location information with tabs for related events.
 */

import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { PageTabs, eventLocationTabs } from '@/components/layout/PageTabs';
import { useEventLocationPage } from '@/features/event-locations/hooks/useEventLocationPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/locations/$id')({
    component: EventLocationViewPage,
    loader: async ({ params }) => ({ eventLocationId: params.id }),
    errorComponent: createErrorComponent('EventLocation'),
    pendingComponent: createPendingComponent()
});

function EventLocationViewPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useEventLocationPage(id);

    return (
        <div className="space-y-4">
            <PageTabs
                tabs={eventLocationTabs}
                basePath={`/events/locations/${id}`}
            />

            <EntityPageBase
                entityType="event-location"
                entityId={id}
                initialMode="view"
                entityData={entityData}
            >
                <EntityViewContent
                    entityType="event-location"
                    entityId={id}
                    sections={entityData.sections}
                    entity={entityData.entity || {}}
                    userPermissions={entityData.userPermissions}
                />
            </EntityPageBase>
        </div>
    );
}
