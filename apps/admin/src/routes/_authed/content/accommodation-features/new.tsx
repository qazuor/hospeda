import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createFeatureConsolidatedConfig } from '@/features/features/config';
import { useCreateFeatureMutation } from '@/features/features/hooks/useFeatureQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/content/accommodation-features/new')({
    component: FeatureCreatePage,
    errorComponent: createErrorComponent('Feature'),
    pendingComponent: createPendingComponent()
});

function FeatureCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const createMutation = useCreateFeatureMutation();

    const entityName = t('admin-entities.entities.feature.singular');
    const entityNamePlural = t('admin-entities.entities.feature.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'feature',
        title: `${t('admin-entities.list.new')} ${entityName}`,
        description: t('admin-entities.entities.feature.description'),
        entityName,
        entityNamePlural,
        basePath: '/content/accommodation-features',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.messages.created').replace('{entity}', entityName),
        successToastMessage: t('admin-entities.messages.created').replace('{entity}', entityName),
        errorToastTitle: t('admin-entities.messages.error.create').replace('{entity}', entityName),
        errorMessage: t('admin-entities.messages.error.create').replace('{entity}', entityName)
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.FEATURE_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                createConsolidatedConfig={createFeatureConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
