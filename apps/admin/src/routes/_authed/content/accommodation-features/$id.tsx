import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { useFeaturePage } from '@/features/features/hooks/useFeaturePage';
import { useDeleteFeatureMutation } from '@/features/features/hooks/useFeatureQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { defaultLocale, trans } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

/**
 * Feature View Route Configuration
 */
export const Route = createFileRoute('/_authed/content/accommodation-features/$id')({
    component: FeatureViewPage,
    loader: async ({ params }) => ({ featureId: params.id }),
    errorComponent: createErrorComponent('Feature'),
    pendingComponent: createPendingComponent()
});

/**
 * Feature View Page Component
 */
/**
 * Resolves the feature display label from its slug via @repo/i18n.
 * Key: `accommodations.featureNames.<slug>` in the default locale.
 * Falls back to the entity id when no translation or slug is available.
 */
function resolveFeatureLabel(slug: string | null | undefined, fallback: string): string {
    if (!slug) return fallback;
    const key = `accommodations.featureNames.${slug}`;
    const translated = trans[defaultLocale as keyof typeof trans]?.[key];
    if (translated && !translated.startsWith('[MISSING:')) return translated;
    return slug;
}

function FeatureViewPage() {
    const { id } = Route.useParams();
    const navigate = useNavigate();
    const { t } = useTranslations();
    const entityData = useFeaturePage(id);

    const feature = entityData.entity as { slug?: string | null } | undefined;
    const displayName = resolveFeatureLabel(feature?.slug, id);

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <DeleteRowButton
                    entityId={id}
                    entityName={displayName}
                    entityLabel={t('admin-entities.entities.feature.singular')}
                    permission={PermissionEnum.FEATURE_DELETE}
                    useDeleteMutation={useDeleteFeatureMutation}
                    variant="full"
                    entityGender="f"
                    onDeleted={() => navigate({ to: '/content/accommodation-features' })}
                />
            </div>
            <EntityPageBase
                entityType="feature"
                entityId={id}
                initialMode="view"
                entityData={entityData}
            >
                <EntityViewContent
                    entityType="feature"
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
