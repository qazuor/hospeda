import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { useHostTradePage } from '@/features/host-trades/hooks/useHostTradePage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum, UpdateHostTradeSchema } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Host-Trade Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/platform/host-trades/$id_/edit')({
    component: HostTradeEditPage,
    loader: async ({ params }) => ({ hostTradeId: params.id }),
    errorComponent: createErrorComponent('HostTrade'),
    pendingComponent: createPendingComponent()
});

/**
 * Edit page for an existing host-trade directory entry.
 * Uses `EntityPageBase` in edit mode with `EntityEditContent`.
 */
function HostTradeEditPage() {
    const { id } = Route.useParams();
    const entityData = useHostTradePage(id);

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.HOST_TRADE_UPDATE]}>
            <div className="space-y-4">
                <EntityPageBase
                    entityType="hostTrade"
                    entityId={id}
                    initialMode="edit"
                    entityData={entityData}
                    zodSchema={UpdateHostTradeSchema}
                >
                    <EntityEditContent
                        entityType="hostTrade"
                        flat
                    />
                </EntityPageBase>
            </div>
        </RoutePermissionGuard>
    );
}
