import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createPostConsolidatedConfig } from '@/features/posts/config';
import { useCreatePostMutation } from '@/features/posts/hooks/usePostQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum, PostCreateInputSchema } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/posts/new')({
    component: PostCreatePage,
    errorComponent: createErrorComponent('Post'),
    pendingComponent: createPendingComponent()
});

function PostCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const createMutation = useCreatePostMutation();

    const entityName = t('admin-entities.entities.post.singular');
    const entityNamePlural = t('admin-entities.entities.post.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'post',
        // 'Publicación' is feminine, so the generic 'Nuevo {entity}' template
        // produces 'Nuevo Publicación' (SPEC-117 D-POSTS.3). Hardcode the
        // gendered title here until i18n supports per-entity gendered keys.
        title: 'Nueva Publicación',
        description: t('admin-entities.entities.post.description'),
        entityName,
        entityNamePlural,
        basePath: '/posts',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        // SPEC-117 D-TOAST.1/2 — title ≠ body and feminine gender.
        successToastTitle: 'Publicación creada',
        successToastMessage: 'La publicación se creó exitosamente',
        errorToastTitle: 'Error al crear la publicación',
        errorMessage: 'No pudimos crear la publicación. Probá de nuevo.'
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.POST_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                zodSchema={PostCreateInputSchema}
                createConsolidatedConfig={() => createPostConsolidatedConfig(t)}
                configDeps={[t]}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
