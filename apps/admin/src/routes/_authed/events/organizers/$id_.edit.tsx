import { EventOrganizerUpdateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { useEventOrganizerPage } from '@/features/event-organizers/hooks/useEventOrganizerPage';
import { createUploadHandler, useMediaUpload } from '@/hooks/use-media-upload';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';

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
    const entityData = useEventOrganizerPage(id);
    const { uploadEntityImage } = useMediaUpload();

    const mediaFieldHandlers = useMemo(
        () => ({
            logo: {
                onUpload: createUploadHandler({
                    entityType: 'eventOrganizer',
                    entityId: id,
                    role: 'organizerLogo',
                    onUpload: (input) => uploadEntityImage.mutateAsync(input)
                })
            }
        }),
        [id, uploadEntityImage]
    );

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.EVENT_ORGANIZER_UPDATE]}>
            <div className="space-y-4">
                <EntityPageBase
                    entityType="event-organizer"
                    entityId={id}
                    initialMode="edit"
                    entityData={entityData}
                    zodSchema={EventOrganizerUpdateInputSchema}
                >
                    <EntityEditContent
                        entityType="event-organizer"
                        fieldHandlers={mediaFieldHandlers}
                        flat
                    />
                </EntityPageBase>
            </div>
        </RoutePermissionGuard>
    );
}
