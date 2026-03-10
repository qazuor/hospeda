import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createTagConsolidatedConfig } from '@/features/tags/config';
import { useCreateTagMutation } from '@/features/tags/hooks/useTagQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum, TagCreateInputSchema } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/settings/tags/new')({
    component: TagCreatePage,
    errorComponent: createErrorComponent('Tag'),
    pendingComponent: createPendingComponent()
});

function TagCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const createMutation = useCreateTagMutation();

    const entityName = t('admin-entities.entities.tag.singular');
    const entityNamePlural = t('admin-entities.entities.tag.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'tag',
        title: `${t('admin-entities.list.new')} ${entityName}`,
        description: t('admin-entities.entities.tag.description'),
        entityName,
        entityNamePlural,
        basePath: '/settings/tags',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.messages.created').replace('{entity}', entityName),
        successToastMessage: t('admin-entities.messages.created').replace('{entity}', entityName),
        errorToastTitle: t('admin-entities.messages.error.create').replace('{entity}', entityName),
        errorMessage: t('admin-entities.messages.error.create').replace('{entity}', entityName)
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.TAG_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                zodSchema={TagCreateInputSchema}
                createConsolidatedConfig={createTagConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
