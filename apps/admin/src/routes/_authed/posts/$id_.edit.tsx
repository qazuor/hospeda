import { RevalidateEntityButton } from '@/components/RevalidateEntityButton';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { PostQualityScore } from '@/features/posts/components/PostQualityScore';
import { usePostPage } from '@/features/posts/hooks/usePostPage';
import { createUploadHandler, useMediaUpload } from '@/hooks/use-media-upload';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum, PostUpdateInputSchema } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';

/**
 * Post Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/posts/$id_/edit')({
    component: PostEditPage,
    loader: async ({ params }) => ({ postId: params.id }),
    errorComponent: createErrorComponent('Post'),
    pendingComponent: createPendingComponent()
});

/**
 * Post Edit Page Component
 *
 * Wires GalleryField (field id: "images") to the media upload/delete API
 * via useMediaUpload and createUploadHandler.
 */
function PostEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = usePostPage(id);

    // Media upload/delete hooks for the gallery field
    const { uploadEntityImage, deleteImage } = useMediaUpload();

    /**
     * Field handlers for the post gallery.
     * - onUpload: calls POST /api/v1/admin/media/upload with role=gallery
     * - onDelete: calls DELETE /api/v1/admin/media?publicId=... for Cloudinary assets.
     *   Non-Cloudinary URLs are handled by GalleryField without calling this.
     */
    const galleryFieldHandlers = useMemo(
        () => ({
            images: {
                onUpload: createUploadHandler({
                    entityType: 'post',
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
        <RoutePermissionGuard permissions={[PermissionEnum.POST_UPDATE]}>
            <div className="space-y-4">
                <div className="flex justify-end">
                    <RevalidateEntityButton
                        entityType="post"
                        entityId={id}
                    />
                </div>
                <EntityPageBase
                    entityType="post"
                    entityId={id}
                    initialMode="edit"
                    entityData={entityData}
                    zodSchema={PostUpdateInputSchema}
                    qualityScore={({ isReduced }) => <PostQualityScore compact={isReduced} />}
                >
                    <EntityEditContent
                        entityType="post"
                        fieldHandlers={galleryFieldHandlers}
                    />
                </EntityPageBase>
            </div>
        </RoutePermissionGuard>
    );
}
