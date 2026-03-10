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
        title: `${t('admin-entities.list.new')} ${entityName}`,
        description: t('admin-entities.entities.eventOrganizer.description'),
        entityName,
        entityNamePlural,
        basePath: '/events/organizers',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.messages.created').replace('{entity}', entityName),
        successToastMessage: t('admin-entities.messages.created').replace('{entity}', entityName),
        errorToastTitle: t('admin-entities.messages.error.create').replace('{entity}', entityName),
        errorMessage: t('admin-entities.messages.error.create').replace('{entity}', entityName)
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.EVENT_ORGANIZER_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                zodSchema={EventOrganizerCreateInputSchema}
                createConsolidatedConfig={createEventOrganizerConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
