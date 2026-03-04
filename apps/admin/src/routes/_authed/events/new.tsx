import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createEventConsolidatedConfig } from '@/features/events/config';
import { useCreateEventMutation } from '@/features/events/hooks/useEventQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
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
        title: `${t('admin-entities.list.new')} ${entityName}`,
        description: t('admin-entities.entities.event.description'),
        entityName,
        entityNamePlural,
        basePath: '/events',
        submitLabel: `${t('admin-entities.form.title.create').replace('{entity}', entityName)}`,
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.messages.created').replace('{entity}', entityName),
        successToastMessage: t('admin-entities.messages.created').replace('{entity}', entityName),
        errorToastTitle: t('admin-entities.messages.error.create').replace('{entity}', entityName),
        errorMessage: t('admin-entities.messages.error.create').replace('{entity}', entityName)
    };

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
