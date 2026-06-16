import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { useHostTradePage } from '@/features/host-trades/hooks/useHostTradePage';
import { useDeleteHostTradeMutation } from '@/features/host-trades/hooks/useHostTradeQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

/**
 * Host-Trade View Route Configuration
 */
export const Route = createFileRoute('/_authed/platform/host-trades/$id')({
    component: HostTradeViewPage,
    loader: async ({ params }) => ({ hostTradeId: params.id }),
    errorComponent: createErrorComponent('HostTrade'),
    pendingComponent: createPendingComponent()
});

/**
 * View page for a single host-trade directory entry.
 * Displays all fields read-only and provides edit / delete actions.
 */
function HostTradeViewPage() {
    const { id } = Route.useParams();
    const navigate = useNavigate();
    const { t } = useTranslations();
    const entityData = useHostTradePage(id);

    const hostTrade = entityData.entity as { name?: string } | undefined;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <DeleteRowButton
                    entityId={id}
                    entityName={hostTrade?.name ?? id}
                    entityLabel={t('admin-entities.entities.hostTrade.singular')}
                    permission={PermissionEnum.HOST_TRADE_DELETE}
                    useDeleteMutation={useDeleteHostTradeMutation}
                    variant="full"
                    entityGender="m"
                    onDeleted={() => navigate({ to: '/platform/host-trades' })}
                />
            </div>
            <EntityPageBase
                entityType="hostTrade"
                entityId={id}
                initialMode="view"
                entityData={entityData}
            >
                <EntityViewContent
                    entityType="hostTrade"
                    entityId={id}
                    sections={entityData.sections}
                    entity={entityData.entity ?? {}}
                    userPermissions={entityData.userPermissions}
                    flat
                />
            </EntityPageBase>
        </div>
    );
}
