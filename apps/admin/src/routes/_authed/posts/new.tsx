import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createPostConsolidatedConfig } from '@/features/posts/config';
import { useCreatePostMutation } from '@/features/posts/hooks/usePostQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/posts/new')({
    component: PostCreatePage,
    errorComponent: createErrorComponent('Post'),
    pendingComponent: createPendingComponent()
});

const createConfig: EntityCreateConfig = {
    entityType: 'post',
    title: 'Crear Artículo',
    description: 'Crear un nuevo artículo',
    entityName: 'Artículo',
    entityNamePlural: 'Artículos',
    basePath: '/posts',
    submitLabel: 'Crear Artículo',
    savingLabel: 'Creando...',
    successToastTitle: 'Artículo creado',
    successToastMessage: 'El artículo se ha creado exitosamente',
    errorToastTitle: 'Error al crear',
    errorMessage: 'Error inesperado al crear el artículo'
};

function PostCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreatePostMutation();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.POST_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                createConsolidatedConfig={createPostConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
