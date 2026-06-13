import { RevalidateEntityButton } from '@/components/RevalidateEntityButton';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { getAccommodationAnchorIds } from '@/components/entity-pages/utils/section-sorter';
import { AccommodationQualityScore } from '@/features/accommodations/components/AccommodationQualityScore';
import { AiTextImproveFieldAddon } from '@/features/accommodations/components/AiTextImproveFieldAddon';
import { useAccommodationHeaderProps } from '@/features/accommodations/hooks/useAccommodationHeaderProps';
import { useAccommodationPage } from '@/features/accommodations/hooks/useAccommodationPage';
import { TranslationSection } from '@/features/content/components/TranslationSection';
import { createUploadHandler, useMediaUpload } from '@/hooks/use-media-upload';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import {
    AccommodationUpdateInputSchema,
    type AiTextImproveFieldType,
    PermissionEnum
} from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useMemo, useRef } from 'react';

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
 * Wires GalleryField (field id: "media.gallery") to the media upload/delete API
 * via useMediaUpload and createUploadHandler.
 */
function AccommodationEditPage() {
    const { id } = Route.useParams();

    const entityData = useAccommodationPage(id);

    // Media upload/delete hooks for the gallery field
    const { uploadEntityImage, deleteImage } = useMediaUpload();

    // SPEC-198 AC-12 (SHOULD-only): client-side audit hint tracking which
    // fields were AI-assisted. This ref is NOT sent to the API — it exists
    // for future UI use (e.g. a "show AI-assisted fields" toggle).
    const aiAssistedFieldsRef = useRef(new Set<string>());

    // SPEC-198 AC-11: AiTextImprovePanel mounted ONLY for description + summary.
    // The addon renders below the field component inside the same grid cell.
    const fieldAddons = useMemo(
        () => ({
            description: (
                <AiTextImproveFieldAddon
                    fieldId="description"
                    fieldType="description"
                    canUse={entityData.canUseAiTextImprove}
                    locale="es"
                    onAiAssisted={(fieldId) => aiAssistedFieldsRef.current.add(fieldId)}
                />
            ),
            summary: (
                <AiTextImproveFieldAddon
                    fieldId="summary"
                    fieldType="summary"
                    canUse={entityData.canUseAiTextImprove}
                    locale="es"
                    onAiAssisted={(fieldId) => aiAssistedFieldsRef.current.add(fieldId)}
                />
            )
        }),
        [entityData.canUseAiTextImprove]
    );

    /**
     * Field handlers for the accommodation gallery.
     * - onUpload: calls POST /api/v1/admin/media/upload with role=gallery
     * - onDelete: calls DELETE /api/v1/admin/media?publicId=... for Cloudinary assets.
     */
    const galleryFieldHandlers = useMemo(
        () => ({
            'media.gallery': {
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

    // Anchor order by role: staff sees "states-moderation" first (spec §4.4)
    const anchorSectionIds = useMemo(
        () => getAccommodationAnchorIds(entityData.userPermissions),
        [entityData.userPermissions]
    );

    // Derive media / subtitle / badges from the loaded entity.
    const headerProps = useAccommodationHeaderProps({ entity: entityData.entity });

    // SPEC-198.1: convert the Set ref to an array and pass as extra save payload.
    // The `onSaveSuccess` callback clears the ref so a subsequent save does not
    // re-send stale field names.
    // eslint-disable-next-line react/hook-use-state -- intentional: ref captures
    // accumulated field names across renders without causing re-renders.
    const clearAiAssistedRef = useCallback(() => {
        aiAssistedFieldsRef.current.clear();
    }, []);

    return (
        <RoutePermissionGuard
            permissions={[
                PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                PermissionEnum.ACCOMMODATION_UPDATE_ANY
            ]}
        >
            <div className="space-y-4">
                <div className="flex justify-end">
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
                    headerMedia={headerProps.media}
                    headerSubtitle={headerProps.subtitle}
                    headerBadges={headerProps.badges}
                    qualityScore={({ isReduced }) => (
                        <AccommodationQualityScore compact={isReduced} />
                    )}
                    extraSavePayload={(): Record<string, unknown> => ({
                        aiAssistedFields: Array.from(
                            aiAssistedFieldsRef.current
                        ) as AiTextImproveFieldType[]
                    })}
                    onSaveSuccess={clearAiAssistedRef}
                >
                    <EntityEditContent
                        entityType="accommodation"
                        fieldHandlers={galleryFieldHandlers}
                        anchorSectionIds={anchorSectionIds}
                        fieldAddons={fieldAddons}
                    />
                    {entityData.entity && (
                        <TranslationSection
                            entityType="accommodation"
                            entityId={id}
                            entity={entityData.entity as Record<string, unknown>}
                        />
                    )}
                </EntityPageBase>
            </div>
        </RoutePermissionGuard>
    );
}
