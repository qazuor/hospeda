import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createAmenityConsolidatedConfig } from '@/features/amenities/config';
import { useCreateAmenityMutation } from '@/features/amenities/hooks/useAmenityQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/content/accommodation-amenities/new')({
    component: AmenityCreatePage,
    errorComponent: createErrorComponent('Amenity'),
    pendingComponent: createPendingComponent()
});

const createConfig: EntityCreateConfig = {
    entityType: 'amenity',
    title: 'Crear Amenidad',
    description: 'Crear una nueva amenidad',
    entityName: 'Amenidad',
    entityNamePlural: 'Amenidades',
    basePath: '/content/accommodation-amenities',
    submitLabel: 'Crear Amenidad',
    savingLabel: 'Creando...',
    successToastTitle: 'Amenidad creada',
    successToastMessage: 'La amenidad se ha creado exitosamente',
    errorToastTitle: 'Error al crear',
    errorMessage: 'Error inesperado al crear la amenidad'
};

function AmenityCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreateAmenityMutation();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.AMENITY_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                createConsolidatedConfig={createAmenityConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
