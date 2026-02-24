import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createTagConsolidatedConfig } from '@/features/tags/config';
import { useCreateTagMutation } from '@/features/tags/hooks/useTagQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/settings/tags/new')({
    component: TagCreatePage,
    errorComponent: createErrorComponent('Tag'),
    pendingComponent: createPendingComponent()
});

const createConfig: EntityCreateConfig = {
    entityType: 'tag',
    title: 'Crear Etiqueta',
    description: 'Crear una nueva etiqueta',
    entityName: 'Etiqueta',
    entityNamePlural: 'Etiquetas',
    basePath: '/settings/tags',
    submitLabel: 'Crear Etiqueta',
    savingLabel: 'Creando...',
    successToastTitle: 'Etiqueta creada',
    successToastMessage: 'La etiqueta se ha creado exitosamente',
    errorToastTitle: 'Error al crear',
    errorMessage: 'Error inesperado al crear la etiqueta'
};

function TagCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreateTagMutation();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.TAG_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                createConsolidatedConfig={createTagConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
