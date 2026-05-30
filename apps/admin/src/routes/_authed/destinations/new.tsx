import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreatePageBase } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createDestinationConsolidatedConfig } from '@/features/destinations/config';
import { useCreateDestinationMutation } from '@/features/destinations/hooks/useDestinationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { DestinationCreateInputSchema, PermissionEnum } from '@repo/schemas';
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
        title: t('admin-entities.list.new').replace('{entity}', entityName),
        description: t('admin-entities.entities.destination.description'),
        entityName,
        entityNamePlural,
        basePath: '/destinations',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        // SPEC-117 D-TOAST.1 — title ≠ body.
        successToastTitle: 'Destino creado',
        successToastMessage: 'El destino se creó exitosamente',
        errorToastTitle: 'Error al crear el destino',
        errorMessage: 'No pudimos crear el destino. Probá de nuevo.'
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.DESTINATION_CREATE]}>
            <EntityCreatePageBase
                config={createConfig}
                zodSchema={DestinationCreateInputSchema}
                createConsolidatedConfig={() => createDestinationConsolidatedConfig(t)}
                configDeps={[t]}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
