import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createEventConsolidatedConfig } from '@/features/events/config';
import { useCreateEventMutation } from '@/features/events/hooks/useEventQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/new')({
    component: EventCreatePage,
    errorComponent: createErrorComponent('Event'),
    pendingComponent: createPendingComponent()
});

const createConfig: EntityCreateConfig = {
    entityType: 'event',
    title: 'Crear Evento',
    description: 'Crear un nuevo evento',
    entityName: 'Evento',
    entityNamePlural: 'Eventos',
    basePath: '/events',
    submitLabel: 'Crear Evento',
    savingLabel: 'Creando...',
    successToastTitle: 'Evento creado',
    successToastMessage: 'El evento se ha creado exitosamente',
    errorToastTitle: 'Error al crear',
    errorMessage: 'Error inesperado al crear el evento'
};

function EventCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreateEventMutation();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.EVENT_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                createConsolidatedConfig={createEventConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
