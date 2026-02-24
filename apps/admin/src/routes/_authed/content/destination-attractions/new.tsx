import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createAttractionConsolidatedConfig } from '@/features/attractions/config';
import { useCreateAttractionMutation } from '@/features/attractions/hooks/useAttractionQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/content/destination-attractions/new')({
    component: AttractionCreatePage,
    errorComponent: createErrorComponent('Attraction'),
    pendingComponent: createPendingComponent()
});

const createConfig: EntityCreateConfig = {
    entityType: 'attraction',
    title: 'Crear Atracción',
    description: 'Crear una nueva atracción',
    entityName: 'Atracción',
    entityNamePlural: 'Atracciones',
    basePath: '/content/destination-attractions',
    submitLabel: 'Crear Atracción',
    savingLabel: 'Creando...',
    successToastTitle: 'Atracción creada',
    successToastMessage: 'La atracción se ha creado exitosamente',
    errorToastTitle: 'Error al crear',
    errorMessage: 'Error inesperado al crear la atracción'
};

function AttractionCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreateAttractionMutation();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.ATTRACTION_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                createConsolidatedConfig={createAttractionConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
