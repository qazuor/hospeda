import {
    type AccommodationImportAccessResponse,
    AccommodationImportAccessResponseSchema
} from '@repo/schemas';
import { getActorFromContext } from '../../../utils/actor';
import { getAccommodationImportAccess } from '../../../utils/listing-access/accommodation-import-access';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Protected read used by the create-flow UI; policy remains server-owned. */
export const protectedImportFromUrlAccessRoute = createProtectedRoute({
    method: 'get',
    path: '/import-from-url/access',
    summary: 'Read accommodation importer access',
    description: 'Returns the server-resolved entitlement or new-user allowance.',
    tags: ['Accommodations'],
    responseSchema: AccommodationImportAccessResponseSchema,
    options: { customRateLimit: { requests: 60, windowMs: 60_000 } },
    handler: async (ctx): Promise<AccommodationImportAccessResponse> => {
        const actor = getActorFromContext(ctx);
        return getAccommodationImportAccess({ userId: actor.id });
    }
});
