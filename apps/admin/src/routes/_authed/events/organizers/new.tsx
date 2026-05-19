import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createEventOrganizerConsolidatedConfig } from '@/features/event-organizers/config';
import { useCreateEventOrganizerMutation } from '@/features/event-organizers/hooks/useEventOrganizerQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { EventOrganizerCreateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/organizers/new')({
    component: EventOrganizerCreatePage,
    errorComponent: createErrorComponent('EventOrganizer'),
    pendingComponent: createPendingComponent()
});

function EventOrganizerCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const createMutation = useCreateEventOrganizerMutation();

    const entityName = t('admin-entities.entities.eventOrganizer.singular');
    const entityNamePlural = t('admin-entities.entities.eventOrganizer.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'event-organizer',
        title: t('admin-entities.list.new').replace('{entity}', entityName),
        description: t('admin-entities.entities.eventOrganizer.description'),
        entityName,
        entityNamePlural,
        basePath: '/events/organizers',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        // SPEC-117 D-TOAST.1 — title ≠ body.
        successToastTitle: 'Organizador creado',
        successToastMessage: 'El organizador se creó exitosamente',
        errorToastTitle: 'Error al crear el organizador',
        errorMessage: 'No pudimos crear el organizador. Probá de nuevo.'
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.EVENT_ORGANIZER_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                zodSchema={EventOrganizerCreateInputSchema}
                createConsolidatedConfig={() => createEventOrganizerConsolidatedConfig(t)}
                configDeps={[t]}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
