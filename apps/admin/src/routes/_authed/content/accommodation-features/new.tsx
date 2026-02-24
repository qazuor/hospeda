import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createFeatureConsolidatedConfig } from '@/features/features/config';
import { useCreateFeatureMutation } from '@/features/features/hooks/useFeatureQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/content/accommodation-features/new')({
    component: FeatureCreatePage,
    errorComponent: createErrorComponent('Feature'),
    pendingComponent: createPendingComponent()
});

const createConfig: EntityCreateConfig = {
    entityType: 'feature',
    title: 'Crear Característica',
    description: 'Crear una nueva característica',
    entityName: 'Característica',
    entityNamePlural: 'Características',
    basePath: '/content/accommodation-features',
    submitLabel: 'Crear Característica',
    savingLabel: 'Creando...',
    successToastTitle: 'Característica creada',
    successToastMessage: 'La característica se ha creado exitosamente',
    errorToastTitle: 'Error al crear',
    errorMessage: 'Error inesperado al crear la característica'
};

function FeatureCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreateFeatureMutation();

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
