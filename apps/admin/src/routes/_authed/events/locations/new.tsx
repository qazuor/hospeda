import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createEventLocationConsolidatedConfig } from '@/features/event-locations/config';
import { useCreateEventLocationMutation } from '@/features/event-locations/hooks/useEventLocationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
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
        title: `${t('admin-entities.list.new')} ${entityName}`,
        description: t('admin-entities.entities.eventLocation.description'),
        entityName,
        entityNamePlural,
        basePath: '/events/locations',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.messages.created').replace('{entity}', entityName),
        successToastMessage: t('admin-entities.messages.created').replace('{entity}', entityName),
        errorToastTitle: t('admin-entities.messages.error.create').replace('{entity}', entityName),
        errorMessage: t('admin-entities.messages.error.create').replace('{entity}', entityName)
    };

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
