import {
    AdminListingFixRequestItemSchema,
    AdminListingFixRequestListQuerySchema,
    PermissionEnum
} from '@repo/schemas';
import { listAdminFixRequests } from '../../../services/listing-publication/listing-fix-request-list.service.js';
import { getClock } from '../../../utils/clock.js';
import { createRouter } from '../../../utils/create-app.js';
import { createAdminListRoute } from '../../../utils/route-factory.js';

/** Lists open fix requests across all listing verticals for authorized moderators. */
export const adminListListingFixRequestsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List open listing fix requests',
    description: 'Lists open fix requests for non-deleted listings.',
    tags: ['Listing fix requests'],
    requiredPermissions: [PermissionEnum.LISTING_MODERATE],
    requestQuery: AdminListingFixRequestListQuerySchema.shape,
    responseSchema: AdminListingFixRequestItemSchema,
    handler: async (_ctx, _params, _body, query) =>
        listAdminFixRequests({
            query: AdminListingFixRequestListQuerySchema.parse(query),
            now: getClock().clock.now()
        })
});

const router = createRouter();
router.route('/', adminListListingFixRequestsRoute);

/** Router mounted at the admin listing fix-request collection path. */
export { router as adminListingFixRequestRoutes };
