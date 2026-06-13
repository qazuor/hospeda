import { RevalidateEntityButton } from '@/components/RevalidateEntityButton';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { PageTabs, destinationTabs } from '@/components/layout/PageTabs';
import { TranslationSection } from '@/features/content/components/TranslationSection';
import { useDestinationPage } from '@/features/destinations/hooks/useDestinationPage';
import { createUploadHandler, useMediaUpload } from '@/hooks/use-media-upload';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { DestinationUpdateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';

/**
 * Destination Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/destinations/$id_/edit')({
    component: DestinationEditPage,
    loader: async ({ params }) => ({ destinationId: params.id }),
    errorComponent: createErrorComponent('Destination'),
    pendingComponent: createPendingComponent()
});

/**
 * Destination Edit Page Component
 *
 * Wires GalleryField (field id: "images") to the media upload/delete API
 * via useMediaUpload and createUploadHandler.
 */
function DestinationEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useDestinationPage(id);

    // Media upload/delete hooks for the gallery field
    const { uploadEntityImage, deleteImage } = useMediaUpload();

    /**
     * Field handlers for the destination gallery.
     * - onUpload: calls POST /api/v1/admin/media/upload with role=gallery
     * - onDelete: calls DELETE /api/v1/admin/media?publicId=... for Cloudinary assets.
     *   Non-Cloudinary URLs are handled by GalleryField without calling this.
     */
    const galleryFieldHandlers = useMemo(
        () => ({
            images: {
                onUpload: createUploadHandler({
                    entityType: 'destination',
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
        <RoutePermissionGuard permissions={[PermissionEnum.DESTINATION_UPDATE]}>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    {/* Level 3 Navigation: Page Tabs */}
                    <PageTabs
                        tabs={destinationTabs}
                        basePath={`/destinations/${id}`}
                    />
                    <RevalidateEntityButton
                        entityType="destination"
                        entityId={id}
                    />
                </div>

                <EntityPageBase
                    entityType="destination"
                    entityId={id}
                    initialMode="edit"
                    entityData={entityData}
                    zodSchema={DestinationUpdateInputSchema}
                >
                    <EntityEditContent
                        entityType="destination"
                        fieldHandlers={galleryFieldHandlers}
                        flat
                    />
                    {entityData.entity && (
                        <TranslationSection
                            entityType="destination"
                            entityId={id}
                            entity={entityData.entity as Record<string, unknown>}
                        />
                    )}
                </EntityPageBase>
            </div>
        </RoutePermissionGuard>
    );
}
