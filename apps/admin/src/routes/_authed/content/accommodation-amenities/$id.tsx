import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { useAmenityPage } from '@/features/amenities/hooks/useAmenityPage';
import { useDeleteAmenityMutation } from '@/features/amenities/hooks/useAmenityQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { defaultLocale, trans } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

/**
 * Amenity View Route Configuration
 */
export const Route = createFileRoute('/_authed/content/accommodation-amenities/$id')({
    component: AmenityViewPage,
    loader: async ({ params }) => ({ amenityId: params.id }),
    errorComponent: createErrorComponent('Amenity'),
    pendingComponent: createPendingComponent()
});

/**
 * Amenity View Page Component
 */
/**
 * Resolves the amenity display label from its slug via @repo/i18n.
 * Key: `accommodations.amenityNames.<slug>` in the default locale.
 * Falls back to the entity id when no translation or slug is available.
 */
function resolveAmenityLabel(slug: string | null | undefined, fallback: string): string {
    if (!slug) return fallback;
    const key = `accommodations.amenityNames.${slug}`;
    const translated = trans[defaultLocale as keyof typeof trans]?.[key];
    if (translated && !translated.startsWith('[MISSING:')) return translated;
    return slug;
}

function AmenityViewPage() {
    const { id } = Route.useParams();
    const navigate = useNavigate();
    const { t } = useTranslations();
    const entityData = useAmenityPage(id);

    const amenity = entityData.entity as { slug?: string | null } | undefined;
    const displayName = resolveAmenityLabel(amenity?.slug, id);

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <DeleteRowButton
                    entityId={id}
                    entityName={displayName}
                    entityLabel={t('admin-entities.entities.amenity.singular')}
                    permission={PermissionEnum.AMENITY_DELETE}
                    useDeleteMutation={useDeleteAmenityMutation}
                    variant="full"
                    entityGender="f"
                    onDeleted={() => navigate({ to: '/content/accommodation-amenities' })}
                />
            </div>
            <EntityPageBase
                entityType="amenity"
                entityId={id}
                initialMode="view"
                entityData={entityData}
            >
                <EntityViewContent
                    entityType="amenity"
                    entityId={id}
                    sections={entityData.sections}
                    entity={entityData.entity || {}}
                    userPermissions={entityData.userPermissions}
                    flat
                />
            </EntityPageBase>
        </div>
    );
}
