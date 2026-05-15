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
        // 'Amenidad' is feminine — generic template produces 'Nuevo Amenidad'
        // (SPEC-117 D-POSTS.3 family). Hardcode gendered title.
        title: 'Nueva Amenidad',
        description: t('admin-entities.entities.amenity.description'),
        entityName,
        entityNamePlural,
        basePath: '/content/accommodation-amenities',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        // Title + message must differ (D-TOAST.1) and gender must match
        // (D-TOAST.2: 'Amenidad creada', not 'creado').
        successToastTitle: 'Amenidad creada',
        successToastMessage: 'La amenidad se creó exitosamente',
        errorToastTitle: 'Error al crear la amenidad',
        errorMessage: 'No pudimos crear la amenidad. Probá de nuevo.'
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.AMENITY_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                zodSchema={AmenityCreateInputSchema}
                createConsolidatedConfig={() => createAmenityConsolidatedConfig(t)}
                configDeps={[t]}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
