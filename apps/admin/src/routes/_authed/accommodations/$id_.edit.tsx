import { RevalidateEntityButton } from '@/components/RevalidateEntityButton';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { PageTabs, accommodationTabs } from '@/components/layout/PageTabs';
import { useAccommodationPage } from '@/features/accommodations/hooks/useAccommodationPage';
import { createUploadHandler, useMediaUpload } from '@/hooks/use-media-upload';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { AccommodationUpdateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';

/**
 * Accommodation Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/accommodations/$id_/edit')({
    component: AccommodationEditPage,
    loader: async ({ params }) => ({ accommodationId: params.id }),
    errorComponent: createErrorComponent('Accommodation'),
    pendingComponent: createPendingComponent()
});

/**
 * Accommodation Edit Page Component
 *
 * Wires GalleryField (field id: "images") to the media upload/delete API
 * via useMediaUpload and createUploadHandler.
 */
function AccommodationEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useAccommodationPage(id);

    // Media upload/delete hooks for the gallery field
    const { uploadEntityImage, deleteImage } = useMediaUpload();

    /**
     * Field handlers for the accommodation gallery.
     * - onUpload: calls POST /api/v1/admin/media/upload with role=gallery
     * - onDelete: calls DELETE /api/v1/admin/media?publicId=... for Cloudinary assets.
     *   Non-Cloudinary URLs are handled by GalleryField without calling this.
     */
    const galleryFieldHandlers = useMemo(
        () => ({
            images: {
                onUpload: createUploadHandler({
                    entityType: 'accommodation',
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
        <RoutePermissionGuard
            permissions={[
                PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                PermissionEnum.ACCOMMODATION_UPDATE_ANY
            ]}
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    {/* Level 3 Navigation: Page Tabs */}
                    <PageTabs
                        tabs={accommodationTabs}
                        basePath={`/accommodations/${id}`}
                    />
                    <RevalidateEntityButton
                        entityType="accommodation"
                        entityId={id}
                    />
                </div>

                <EntityPageBase
                    entityType="accommodation"
                    entityId={id}
                    initialMode="edit"
                    entityData={entityData}
                    zodSchema={AccommodationUpdateInputSchema}
                >
                    <EntityEditContent
                        entityType="accommodation"
                        fieldHandlers={galleryFieldHandlers}
                    />
                </EntityPageBase>
            </div>
        </RoutePermissionGuard>
    );
}
