import { UserModel } from '@repo/db';
import {
    AdminTrialSummaryQuerySchema,
    AdminTrialSummaryResponseSchema,
    PermissionEnum,
    UserIdSchema
} from '@repo/schemas';
import { entityNotFoundError } from '@repo/service-core';
import { readAdminTrialSummary } from '../../../services/listing-notices/admin-trial-summary.service';
import { createAdminRoute } from '../../../utils/route-factory';

/** HOS-1677 TEST:V8a:7 (panel, fila 4): read one user's accumulated trial days. */
export const adminGetUserTrialSummaryRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/trial-summary',
    summary: 'Get user trial summary (admin)',
    description: 'Reads one user trial summary and its pinned deadline ceiling.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT],
    requestParams: { id: UserIdSchema },
    requestQuery: AdminTrialSummaryQuerySchema.shape,
    responseSchema: AdminTrialSummaryResponseSchema,
    handler: async (_ctx, params, _body, query) => {
        const vertical = AdminTrialSummaryQuerySchema.shape.vertical.parse(query?.vertical);
        const id = UserIdSchema.parse(params.id);
        if (!(await new UserModel().findById(id)))
            throw entityNotFoundError({ entityName: 'User' });
        return readAdminTrialSummary({ userId: id, vertical });
    }
});
