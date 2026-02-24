import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createDestinationConsolidatedConfig } from '@/features/destinations/config';
import { useCreateDestinationMutation } from '@/features/destinations/hooks/useDestinationQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/destinations/new')({
    component: DestinationCreatePage,
    errorComponent: createErrorComponent('Destination'),
    pendingComponent: createPendingComponent()
});

const createConfig: EntityCreateConfig = {
    entityType: 'destination',
    title: 'Crear Destino',
    description: 'Crear un nuevo destino turístico',
    entityName: 'Destino',
    entityNamePlural: 'Destinos',
    basePath: '/destinations',
    submitLabel: 'Crear Destino',
    savingLabel: 'Creando...',
    successToastTitle: 'Destino creado',
    successToastMessage: 'El destino se ha creado exitosamente',
    errorToastTitle: 'Error al crear',
    errorMessage: 'Error inesperado al crear el destino'
};

function DestinationCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreateDestinationMutation();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.DESTINATION_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                createConsolidatedConfig={createDestinationConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
