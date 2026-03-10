import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createAmenityConsolidatedConfig } from '@/features/amenities/config';
import { useCreateAmenityMutation } from '@/features/amenities/hooks/useAmenityQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { AmenityCreateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/content/accommodation-amenities/new')({
    component: AmenityCreatePage,
    errorComponent: createErrorComponent('Amenity'),
    pendingComponent: createPendingComponent()
});

function AmenityCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const createMutation = useCreateAmenityMutation();

    const entityName = t('admin-entities.entities.amenity.singular');
    const entityNamePlural = t('admin-entities.entities.amenity.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'amenity',
        title: `${t('admin-entities.list.new')} ${entityName}`,
        description: t('admin-entities.entities.amenity.description'),
        entityName,
        entityNamePlural,
        basePath: '/content/accommodation-amenities',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.messages.created').replace('{entity}', entityName),
        successToastMessage: t('admin-entities.messages.created').replace('{entity}', entityName),
        errorToastTitle: t('admin-entities.messages.error.create').replace('{entity}', entityName),
        errorMessage: t('admin-entities.messages.error.create').replace('{entity}', entityName)
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.AMENITY_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                zodSchema={AmenityCreateInputSchema}
                createConsolidatedConfig={createAmenityConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
