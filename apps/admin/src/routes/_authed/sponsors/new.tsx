import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createSponsorConsolidatedConfig } from '@/features/sponsors/config';
import { useCreateSponsorMutation } from '@/features/sponsors/hooks/useSponsorQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/sponsors/new')({
    component: SponsorCreatePage,
    errorComponent: createErrorComponent('Sponsor'),
    pendingComponent: createPendingComponent()
});

const createConfig: EntityCreateConfig = {
    entityType: 'sponsor',
    title: 'Crear Patrocinador',
    description: 'Crear un nuevo patrocinador',
    entityName: 'Patrocinador',
    entityNamePlural: 'Patrocinadores',
    basePath: '/sponsors',
    submitLabel: 'Crear Patrocinador',
    savingLabel: 'Creando...',
    successToastTitle: 'Patrocinador creado',
    successToastMessage: 'El patrocinador se ha creado exitosamente',
    errorToastTitle: 'Error al crear',
    errorMessage: 'Error inesperado al crear el patrocinador'
};

function SponsorCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreateSponsorMutation();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.POST_SPONSOR_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                createConsolidatedConfig={createSponsorConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
