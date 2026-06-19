import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreatePageBase } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createHostTradeConsolidatedConfig } from '@/features/host-trades/config/host-trade-consolidated.config';
import { useCreateHostTradeMutation } from '@/features/host-trades/hooks/useHostTradeQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { CreateHostTradeSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/platform/host-trades/new')({
    component: HostTradeCreatePage,
    errorComponent: createErrorComponent('admin-entities.entities.hostTrade.singular'),
    pendingComponent: createPendingComponent()
});

/**
 * Create page for a new host-trade directory entry.
 */
function HostTradeCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    // TYPE-WORKAROUND: EntityCreatePageBase expects a generic mutation shape;
    // useCreateHostTradeMutation returns a strongly-typed variant that is
    // structurally compatible at runtime (brand-only mismatch, safe at the call site).
    const createMutation = useCreateHostTradeMutation() as unknown as {
        mutateAsync: (values: Record<string, unknown>) => Promise<unknown>;
        isPending: boolean;
    };

    const entityName = t('admin-entities.entities.hostTrade.singular');
    const entityNamePlural = t('admin-entities.entities.hostTrade.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'hostTrade',
        title: t('admin-entities.hostTrade.create.title'),
        description: t('admin-entities.entities.hostTrade.description'),
        entityName,
        entityNamePlural,
        basePath: '/platform/host-trades',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.hostTrade.create.successTitle'),
        successToastMessage: t('admin-entities.hostTrade.create.successMessage'),
        errorToastTitle: t('admin-entities.hostTrade.create.errorTitle'),
        errorMessage: t('admin-entities.hostTrade.create.errorMessage')
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.HOST_TRADE_CREATE]}>
            <EntityCreatePageBase
                config={createConfig}
                zodSchema={CreateHostTradeSchema}
                createConsolidatedConfig={() => createHostTradeConsolidatedConfig(t)}
                configDeps={[t]}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}
