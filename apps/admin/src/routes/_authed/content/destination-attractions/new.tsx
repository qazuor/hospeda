import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createAttractionConsolidatedConfig } from '@/features/attractions/config';
import { useCreateAttractionMutation } from '@/features/attractions/hooks/useAttractionQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/content/destination-attractions/new')({
    component: AttractionCreatePage,
    errorComponent: createErrorComponent('Attraction'),
    pendingComponent: createPendingComponent()
});

function AttractionCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const createMutation = useCreateAttractionMutation();

    const entityName = t('admin-entities.entities.attraction.singular');
    const entityNamePlural = t('admin-entities.entities.attraction.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'attraction',
        title: `${t('admin-entities.list.new')} ${entityName}`,
        description: t('admin-entities.entities.attraction.description'),
        entityName,
        entityNamePlural,
        basePath: '/content/destination-attractions',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.messages.created').replace('{entity}', entityName),
        successToastMessage: t('admin-entities.messages.created').replace('{entity}', entityName),
        errorToastTitle: t('admin-entities.messages.error.create').replace('{entity}', entityName),
        errorMessage: t('admin-entities.messages.error.create').replace('{entity}', entityName)
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.ATTRACTION_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                createConsolidatedConfig={createAttractionConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
