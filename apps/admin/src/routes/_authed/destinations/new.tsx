import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createDestinationConsolidatedConfig } from '@/features/destinations/config';
import { useCreateDestinationMutation } from '@/features/destinations/hooks/useDestinationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/destinations/new')({
    component: DestinationCreatePage,
    errorComponent: createErrorComponent('Destination'),
    pendingComponent: createPendingComponent()
});

function DestinationCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const createMutation = useCreateDestinationMutation();

    const entityName = t('admin-entities.entities.destination.singular');
    const entityNamePlural = t('admin-entities.entities.destination.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'destination',
        title: `${t('admin-entities.list.new')} ${entityName}`,
        description: t('admin-entities.entities.destination.description'),
        entityName,
        entityNamePlural,
        basePath: '/destinations',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.messages.created').replace('{entity}', entityName),
        successToastMessage: t('admin-entities.messages.created').replace('{entity}', entityName),
        errorToastTitle: t('admin-entities.messages.error.create').replace('{entity}', entityName),
        errorMessage: t('admin-entities.messages.error.create').replace('{entity}', entityName)
    };

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
