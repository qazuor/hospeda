import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createUserConsolidatedConfig } from '@/features/users/config';
import { useCreateUserMutation } from '@/features/users/hooks/useUserQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/access/users/new')({
    component: UserCreatePage,
    errorComponent: createErrorComponent('User'),
    pendingComponent: createPendingComponent()
});

const createConfig: EntityCreateConfig = {
    entityType: 'user',
    title: 'Crear Usuario',
    description: 'Crear un nuevo usuario',
    entityName: 'Usuario',
    entityNamePlural: 'Usuarios',
    basePath: '/access/users',
    submitLabel: 'Crear Usuario',
    savingLabel: 'Creando...',
    successToastTitle: 'Usuario creado',
    successToastMessage: 'El usuario se ha creado exitosamente',
    errorToastTitle: 'Error al crear',
    errorMessage: 'Error inesperado al crear el usuario'
};

function UserCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreateUserMutation();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.USER_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                createConsolidatedConfig={createUserConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
