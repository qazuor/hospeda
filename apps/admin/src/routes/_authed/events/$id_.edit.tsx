import { RevalidateEntityButton } from '@/components/RevalidateEntityButton';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { TranslationSection } from '@/features/content/components/TranslationSection';
import { EventQualityScore } from '@/features/events/components/EventQualityScore';
import { useEventPage } from '@/features/events/hooks/useEventPage';
import { createUploadHandler, useMediaUpload } from '@/hooks/use-media-upload';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { EventUpdateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';

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
 *
 * Wires GalleryField (field id: "images") to the media upload/delete API
 * via useMediaUpload and createUploadHandler.
 */
function EventEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useEventPage(id);

    // Media upload/delete hooks for the gallery field
    const { uploadEntityImage, deleteImage } = useMediaUpload();

    /**
     * Field handlers for the event gallery.
     * - onUpload: calls POST /api/v1/admin/media/upload with role=gallery
     * - onDelete: calls DELETE /api/v1/admin/media?publicId=... for Cloudinary assets.
     *   Non-Cloudinary URLs are handled by GalleryField without calling this.
     */
    const galleryFieldHandlers = useMemo(
        () => ({
            images: {
                onUpload: createUploadHandler({
                    entityType: 'event',
                    entityId: id,
                    role: 'gallery',
                    onUpload: (input) => uploadEntityImage.mutateAsync(input)
                }),
                onDelete: async (publicId: string) => {
                    await deleteImage.mutateAsync({ publicId });
                }
            }
        }),
        [id, uploadEntityImage, deleteImage]
    );

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.EVENT_UPDATE]}>
            <div className="space-y-4">
                <div className="flex justify-end">
                    <RevalidateEntityButton
                        entityType="event"
                        entityId={id}
                    />
                </div>
                <EntityPageBase
                    entityType="event"
                    entityId={id}
                    initialMode="edit"
                    entityData={entityData}
                    zodSchema={EventUpdateInputSchema}
                    qualityScore={({ isReduced }) => <EventQualityScore compact={isReduced} />}
                >
                    <EntityEditContent
                        entityType="event"
                        fieldHandlers={galleryFieldHandlers}
                    />
                    {entityData.entity && (
                        <TranslationSection
                            entityType="event"
                            entityId={id}
                            entity={entityData.entity as Record<string, unknown>}
                        />
                    )}
                </EntityPageBase>
            </div>
        </RoutePermissionGuard>
    );
}
