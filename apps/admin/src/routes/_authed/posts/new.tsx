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
        title: `${t('admin-entities.list.new')} ${entityName}`,
        description: t('admin-entities.entities.post.description'),
        entityName,
        entityNamePlural,
        basePath: '/posts',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.messages.created').replace('{entity}', entityName),
        successToastMessage: t('admin-entities.messages.created').replace('{entity}', entityName),
        errorToastTitle: t('admin-entities.messages.error.create').replace('{entity}', entityName),
        errorMessage: t('admin-entities.messages.error.create').replace('{entity}', entityName)
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.POST_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                zodSchema={PostCreateInputSchema}
                createConsolidatedConfig={createPostConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
