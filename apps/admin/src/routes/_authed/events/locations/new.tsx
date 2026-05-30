import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreatePageBase } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createEventLocationConsolidatedConfig } from '@/features/event-locations/config';
import { useCreateEventLocationMutation } from '@/features/event-locations/hooks/useEventLocationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { EventLocationCreateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/locations/new')({
    component: EventLocationCreatePage,
    errorComponent: createErrorComponent('EventLocation'),
    pendingComponent: createPendingComponent()
});

function EventLocationCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const createMutation = useCreateEventLocationMutation();

    const entityName = t('admin-entities.entities.eventLocation.singular');
    const entityNamePlural = t('admin-entities.entities.eventLocation.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'event-location',
        // 'Ubicación' is feminine (SPEC-117 D-POSTS.3 family).
        title: 'Nueva Ubicación',
        description: t('admin-entities.entities.eventLocation.description'),
        entityName,
        entityNamePlural,
        basePath: '/events/locations',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        // SPEC-117 D-TOAST.1/2 — title ≠ body and feminine gender.
        successToastTitle: 'Ubicación creada',
        successToastMessage: 'La ubicación se creó exitosamente',
        errorToastTitle: 'Error al crear la ubicación',
        errorMessage: 'No pudimos crear la ubicación. Probá de nuevo.'
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.EVENT_LOCATION_CREATE]}>
            <EntityCreatePageBase
                config={createConfig}
                zodSchema={EventLocationCreateInputSchema}
                createConsolidatedConfig={() => createEventLocationConsolidatedConfig(t)}
                configDeps={[t]}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
