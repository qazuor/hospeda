import { EventUpdateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { eventTabs, PageTabs } from '@/components/layout/PageTabs';
import { RevalidateEntityButton } from '@/components/RevalidateEntityButton';
import { ContentStatePanel } from '@/features/content/components/ContentStatePanel';
import { TranslationSection } from '@/features/content/components/TranslationSection';
import { EventQualityScore } from '@/features/events/components/EventQualityScore';
import { useEventPage } from '@/features/events/hooks/useEventPage';
import { createUploadHandler, useMediaUpload } from '@/hooks/use-media-upload';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';

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
 * Wires featured-image and gallery fields to the admin media upload API.
 */
function EventEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useEventPage(id);

    // Media upload/delete hooks for the event media fields.
    const { uploadEntityImage, deleteImage } = useMediaUpload();

    /**
     * Field handlers for the event media fields.
     * - featured image: POST /api/v1/admin/media/upload with role=featured
     * - gallery: POST /api/v1/admin/media/upload with role=gallery
     * - onDelete: calls DELETE /api/v1/admin/media?publicId=... for Cloudinary assets.
     *   Non-Cloudinary URLs are handled by GalleryField without calling this.
     */
    const mediaFieldHandlers = useMemo(
        () => ({
            'media.featuredImage': {
                onUpload: createUploadHandler({
                    entityType: 'event',
                    entityId: id,
                    role: 'featured',
                    onUpload: (input) => uploadEntityImage.mutateAsync(input)
                })
            },
            'media.gallery': {
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
                <div className="flex items-center justify-between gap-4">
                    <PageTabs
                        tabs={eventTabs}
                        basePath={`/events/${id}`}
                    />
                    <RevalidateEntityButton
                        entityType="event"
                        entityId={id}
                    />
                </div>
                {entityData.entity && (
                    <ContentStatePanel
                        entityType="event"
                        entityId={id}
                        entityName={(entityData.entity as { name?: string }).name ?? ''}
                        visibility={(entityData.entity as { visibility?: string }).visibility}
                        moderationState={
                            (entityData.entity as { moderationState?: string }).moderationState
                        }
                        lifecycleState={
                            (entityData.entity as { lifecycleState?: string }).lifecycleState
                        }
                    />
                )}
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
                        fieldHandlers={mediaFieldHandlers}
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
