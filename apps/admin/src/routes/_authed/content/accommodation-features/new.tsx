import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createFeatureConsolidatedConfig } from '@/features/features/config';
import { useCreateFeatureMutation } from '@/features/features/hooks/useFeatureQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { FeatureCreateInputSchema, PermissionEnum } from '@repo/schemas';
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
        // 'Característica' is feminine (SPEC-117 D-POSTS.3 family).
        title: 'Nueva Característica',
        description: t('admin-entities.entities.feature.description'),
        entityName,
        entityNamePlural,
        basePath: '/content/accommodation-features',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        // SPEC-117 D-TOAST.1/2 — title ≠ body and feminine gender.
        successToastTitle: 'Característica creada',
        successToastMessage: 'La característica se creó exitosamente',
        errorToastTitle: 'Error al crear la característica',
        errorMessage: 'No pudimos crear la característica. Probá de nuevo.'
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.FEATURE_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                zodSchema={FeatureCreateInputSchema}
                createConsolidatedConfig={() => createFeatureConsolidatedConfig(t)}
                configDeps={[t]}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
