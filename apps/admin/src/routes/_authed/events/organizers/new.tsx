import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createEventOrganizerConsolidatedConfig } from '@/features/event-organizers/config';
import { useCreateEventOrganizerMutation } from '@/features/event-organizers/hooks/useEventOrganizerQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/organizers/new')({
    component: EventOrganizerCreatePage,
    errorComponent: createErrorComponent('EventOrganizer'),
    pendingComponent: createPendingComponent()
});

const createConfig: EntityCreateConfig = {
    entityType: 'event-organizer',
    title: 'Crear Organizador',
    description: 'Crear un nuevo organizador de eventos',
    entityName: 'Organizador de Eventos',
    entityNamePlural: 'Organizadores de Eventos',
    basePath: '/events/organizers',
    submitLabel: 'Crear Organizador',
    savingLabel: 'Creando...',
    successToastTitle: 'Organizador creado',
    successToastMessage: 'El organizador de eventos se ha creado exitosamente',
    errorToastTitle: 'Error al crear',
    errorMessage: 'Error inesperado al crear el organizador de eventos'
};

function EventOrganizerCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreateEventOrganizerMutation();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.EVENT_ORGANIZER_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                createConsolidatedConfig={createEventOrganizerConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
