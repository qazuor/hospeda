import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreatePageBase } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createEventConsolidatedConfig } from '@/features/events/config';
import { useCreateEventMutation } from '@/features/events/hooks/useEventQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { EventCreateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/new')({
    component: EventCreatePage,
    errorComponent: createErrorComponent('Event'),
    pendingComponent: createPendingComponent()
});

function EventCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const createMutation = useCreateEventMutation();

    const entityName = t('admin-entities.entities.event.singular');
    const entityNamePlural = t('admin-entities.entities.event.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'event',
        title: t('admin-entities.list.new').replace('{entity}', entityName),
        description: t('admin-entities.entities.event.description'),
        entityName,
        entityNamePlural,
        basePath: '/events',
        submitLabel: `${t('admin-entities.form.title.create').replace('{entity}', entityName)}`,
        savingLabel: t('admin-entities.messages.saving'),
        // SPEC-117 D-TOAST.1 — title ≠ body.
        successToastTitle: 'Evento creado',
        successToastMessage: 'El evento se creó exitosamente',
        errorToastTitle: 'Error al crear el evento',
        errorMessage: 'No pudimos crear el evento. Probá de nuevo.'
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.EVENT_CREATE]}>
            <EntityCreatePageBase
                config={createConfig}
                zodSchema={EventCreateInputSchema}
                createConsolidatedConfig={() => createEventConsolidatedConfig(t)}
                configDeps={[t]}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
