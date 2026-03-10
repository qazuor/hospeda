import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createSponsorConsolidatedConfig } from '@/features/sponsors/config';
import { useCreateSponsorMutation } from '@/features/sponsors/hooks/useSponsorQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum, PostSponsorCreateInputSchema } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/sponsors/new')({
    component: SponsorCreatePage,
    errorComponent: createErrorComponent('Sponsor'),
    pendingComponent: createPendingComponent()
});

function SponsorCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const createMutation = useCreateSponsorMutation();

    const entityName = t('admin-entities.entities.sponsor.singular');
    const entityNamePlural = t('admin-entities.entities.sponsor.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'sponsor',
        title: `${t('admin-entities.list.new')} ${entityName}`,
        description: t('admin-entities.entities.sponsor.description'),
        entityName,
        entityNamePlural,
        basePath: '/sponsors',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.messages.created').replace('{entity}', entityName),
        successToastMessage: t('admin-entities.messages.created').replace('{entity}', entityName),
        errorToastTitle: t('admin-entities.messages.error.create').replace('{entity}', entityName),
        errorMessage: t('admin-entities.messages.error.create').replace('{entity}', entityName)
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.POST_SPONSOR_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                zodSchema={PostSponsorCreateInputSchema}
                createConsolidatedConfig={createSponsorConsolidatedConfig}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
