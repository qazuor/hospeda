import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { useEventPage } from '@/features/events/hooks/useEventPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Event Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/events/$id_/edit')({
    component: EventEditPage,
    loader: async ({ params }) => ({ eventId: params.id }),
    errorComponent: createErrorComponent('Event'),
    pendingComponent: createPendingComponent()
});

/**
 * Event Edit Page Component
 */
function EventEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useEventPage(id);

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.EVENT_UPDATE]}>
            <div className="space-y-4">
                <EntityPageBase
                    entityType="event"
                    entityId={id}
                    initialMode="edit"
                    entityData={entityData}
                >
                    <EntityEditContent entityType="event" />
                </EntityPageBase>
            </div>
        </RoutePermissionGuard>
    );
}
