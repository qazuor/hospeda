import { DestinationUpdateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { destinationTabs, PageTabs } from '@/components/layout/PageTabs';
import { RevalidateEntityButton } from '@/components/RevalidateEntityButton';
import { TranslationSection } from '@/features/content/components/TranslationSection';
import { useDestinationPage } from '@/features/destinations/hooks/useDestinationPage';
import { createUploadHandler, useMediaUpload } from '@/hooks/use-media-upload';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';

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
 * Wires featured-image and gallery fields to the admin media upload API.
 */
function DestinationEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useDestinationPage(id);

    // Media upload/delete hooks for the destination media fields.
    const { uploadEntityImage, deleteImage } = useMediaUpload();

    /**
     * Field handlers for the destination media fields.
     * - featured image: POST /api/v1/admin/media/upload with role=featured
     * - gallery: POST /api/v1/admin/media/upload with role=gallery
     * - onDelete: calls DELETE /api/v1/admin/media?publicId=... for Cloudinary assets.
     *   Non-Cloudinary URLs are handled by GalleryField without calling this.
     */
    const mediaFieldHandlers = useMemo(
        () => ({
            'media.featuredImage': {
                onUpload: createUploadHandler({
                    entityType: 'destination',
                    entityId: id,
                    role: 'featured',
                    onUpload: (input) => uploadEntityImage.mutateAsync(input)
                })
            },
            'media.gallery': {
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
                        fieldHandlers={mediaFieldHandlers}
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
