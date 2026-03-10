import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createUserConsolidatedConfig } from '@/features/users/config';
import { useCreateUserMutation } from '@/features/users/hooks/useUserQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum, UserCreateInputSchema } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/access/users/new')({
    component: UserCreatePage,
    errorComponent: createErrorComponent('User'),
    pendingComponent: createPendingComponent()
});

function UserCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const createMutation = useCreateUserMutation();

    const entityName = t('admin-entities.entities.user.singular');
    const entityNamePlural = t('admin-entities.entities.user.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'user',
        title: `${t('admin-entities.list.new')} ${entityName}`,
        description: t('admin-entities.entities.user.description'),
        entityName,
        entityNamePlural,
        basePath: '/access/users',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.messages.created').replace('{entity}', entityName),
        successToastMessage: t('admin-entities.messages.created').replace('{entity}', entityName),
        errorToastTitle: t('admin-entities.messages.error.create').replace('{entity}', entityName),
        errorMessage: t('admin-entities.messages.error.create').replace('{entity}', entityName)
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.USER_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                zodSchema={UserCreateInputSchema}
                createConsolidatedConfig={createUserConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
