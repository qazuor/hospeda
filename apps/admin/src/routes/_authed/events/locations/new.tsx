import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createEventLocationConsolidatedConfig } from '@/features/event-locations/config';
import { useCreateEventLocationMutation } from '@/features/event-locations/hooks/useEventLocationQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/locations/new')({
    component: EventLocationCreatePage,
    errorComponent: createErrorComponent('EventLocation'),
    pendingComponent: createPendingComponent()
});

const createConfig: EntityCreateConfig = {
    entityType: 'event-location',
    title: 'Crear Ubicación',
    description: 'Crear una nueva ubicación de evento',
    entityName: 'Ubicación de Evento',
    entityNamePlural: 'Ubicaciones de Eventos',
    basePath: '/events/locations',
    submitLabel: 'Crear Ubicación',
    savingLabel: 'Creando...',
    successToastTitle: 'Ubicación creada',
    successToastMessage: 'La ubicación de evento se ha creado exitosamente',
    errorToastTitle: 'Error al crear',
    errorMessage: 'Error inesperado al crear la ubicación de evento'
};

function EventLocationCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreateEventLocationMutation();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.EVENT_LOCATION_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                createConsolidatedConfig={createEventLocationConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
