import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { useFeaturePage } from '@/features/features/hooks/useFeaturePage';
import { useDeleteFeatureMutation } from '@/features/features/hooks/useFeatureQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
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
function FeatureViewPage() {
    const { id } = Route.useParams();
    const navigate = useNavigate();
    const { t } = useTranslations();
    const entityData = useFeaturePage(id);

    const feature = entityData.entity as { name?: string } | undefined;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <DeleteRowButton
                    entityId={id}
                    entityName={feature?.name || id}
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
                />
            </EntityPageBase>
        </div>
    );
}
