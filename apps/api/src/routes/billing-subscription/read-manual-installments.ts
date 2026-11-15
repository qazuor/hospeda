import { OwnManualInstallmentsResponseSchema, PermissionEnum } from '@repo/schemas';
import { getActorFromContext } from '../../utils/actor';
import { createProtectedRoute } from '../../utils/route-factory';
import { readOwnManualInstallments } from './read-own-manual-installments';

/** Read the authenticated caller's currently open manual installments. */
export const protectedReadManualInstallmentsRoute = createProtectedRoute({
    method: 'get',
    path: '/manual-installments',
    summary: 'Read own open manual installments',
    description: 'Returns the authenticated caller’s open manual installment payment windows.',
    tags: ['Billing subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_VIEW_OWN],
    emailUnverifiedOperation: 'READ_OWN',
    responseSchema: OwnManualInstallmentsResponseSchema,
    handler: async (ctx) => ({
        installments: await readOwnManualInstallments(getActorFromContext(ctx).id)
    })
});
