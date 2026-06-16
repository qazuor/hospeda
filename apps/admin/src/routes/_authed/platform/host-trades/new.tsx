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
    errorComponent: createErrorComponent('HostTrade'),
    pendingComponent: createPendingComponent()
});

/**
 * Create page for a new host-trade directory entry.
 */
function HostTradeCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    // Cast needed: EntityCreatePageBase expects a generic mutation shape;
    // useCreateHostTradeMutation returns a strongly-typed variant that is
    // structurally compatible at runtime.
    const createMutation = useCreateHostTradeMutation() as unknown as {
        mutateAsync: (values: Record<string, unknown>) => Promise<unknown>;
        isPending: boolean;
    };

    const entityName = t('admin-entities.entities.hostTrade.singular');
    const entityNamePlural = t('admin-entities.entities.hostTrade.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'hostTrade',
        title: 'Nuevo Oficio',
        description: t('admin-entities.entities.hostTrade.description'),
        entityName,
        entityNamePlural,
        basePath: '/platform/host-trades',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: 'Oficio creado',
        successToastMessage: 'El oficio se creó exitosamente',
        errorToastTitle: 'Error al crear el oficio',
        errorMessage: 'No pudimos crear el oficio. Probá de nuevo.'
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
