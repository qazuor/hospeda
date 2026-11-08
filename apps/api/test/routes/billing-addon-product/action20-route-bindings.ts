import type { Binding } from '../administrative-action-route-permissions.guard.fixtures.js';

/** Route gates for administrative action 20. */
export const ACTION_20_ROUTE_BINDINGS: readonly Binding[] = [
    {
        kind: 'required',
        file: 'apps/api/src/routes/billing-addon-product/admin/index.ts',
        route: 'adminPreviewAddonVersionPublicationRoute'
    },
    {
        kind: 'required',
        file: 'apps/api/src/routes/billing-addon-product/admin/index.ts',
        route: 'adminPublishAddonVersionRoute'
    }
];
